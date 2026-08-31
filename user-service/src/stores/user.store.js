import { pool } from "../config/database.js";

const memoryUsers = new Map();
const selectUser = `
  SELECT u.id, u.email, u.username, u.password_hash, u.status, u.token_version,
         u.created_at, u.updated_at,
         COALESCE(JSON_ARRAYAGG(r.name), JSON_ARRAY()) AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

function normalize(row) {
  if (!row) return null;
  const roles = typeof row.roles === "string" ? JSON.parse(row.roles) : row.roles;
  return {
    ...row,
    roles: (roles || []).filter(Boolean),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

async function findWhere(column, value) {
  if (!pool) {
    return [...memoryUsers.values()].find((user) => user[column] === value) || null;
  }
  const [rows] = await pool.execute(`${selectUser} WHERE u.${column} = ? GROUP BY u.id LIMIT 1`, [
    value,
  ]);
  return normalize(rows[0]);
}

export const userStore = {
  async create(user) {
    if (!pool) {
      const now = new Date().toISOString();
      const saved = { ...user, created_at: now, updated_at: now };
      memoryUsers.set(saved.id, saved);
      return saved;
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT INTO users (id, email, username, password_hash, status) VALUES (?, ?, ?, ?, ?)",
        [user.id, user.email, user.username, user.password_hash, user.status],
      );
      for (const role of user.roles) {
        await connection.execute(
          "INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?",
          [user.id, role],
        );
      }
      await connection.commit();
      return this.findById(user.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  findById(id) {
    return findWhere("id", id);
  },
  findByEmail(email) {
    return findWhere("email", email);
  },
  findByUsername(username) {
    return findWhere("username", username);
  },
  async update(id, changes) {
    if (!pool) {
      const user = memoryUsers.get(id);
      if (!user) return null;
      Object.assign(user, changes, { updated_at: new Date().toISOString() });
      return user;
    }
    const allowed = ["username", "status", "password_hash", "token_version"];
    const entries = Object.entries(changes).filter(([key]) => allowed.includes(key));
    if (entries.length) {
      await pool.execute(
        `UPDATE users SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
        [...entries.map(([, value]) => value), id],
      );
    }
    return this.findById(id);
  },
  async incrementTokenVersion(id) {
    if (!pool) {
      const user = memoryUsers.get(id);
      if (!user) return null;
      user.token_version = (user.token_version || 0) + 1;
      user.updated_at = new Date().toISOString();
      return user;
    }
    await pool.execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [id]);
    return this.findById(id);
  },
  async list({ page, limit, status, role, search }) {
    if (!pool) {
      let users = [...memoryUsers.values()];
      if (status) users = users.filter((user) => user.status === status);
      if (role) users = users.filter((user) => user.roles.includes(role));
      if (search) {
        const value = search.toLowerCase();
        users = users.filter((user) =>
          `${user.email} ${user.username}`.toLowerCase().includes(value),
        );
      }
      const total = users.length;
      return { users: users.slice((page - 1) * limit, page * limit), total };
    }
    const where = [];
    const params = [];
    if (status) {
      where.push("u.status = ?");
      params.push(status);
    }
    if (role) {
      where.push(
        "EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON r2.id = ur2.role_id WHERE ur2.user_id = u.id AND r2.name = ?)",
      );
      params.push(role);
    }
    if (search) {
      where.push("(u.email LIKE ? OR u.username LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [countRows] = await pool.execute(`SELECT COUNT(*) total FROM users u ${clause}`, params);
    const [rows] = await pool.execute(
      `${selectUser} ${clause} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String((page - 1) * limit)],
    );
    return { users: rows.map(normalize), total: Number(countRows[0].total) };
  },
  async addRole(id, role) {
    if (!pool) {
      const user = memoryUsers.get(id);
      if (!user) return null;
      user.roles = [...new Set([...user.roles, role])];
      user.updated_at = new Date().toISOString();
      return user;
    }
    const [result] = await pool.execute(
      "INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?",
      [id, role],
    );
    if (!result.affectedRows && !(await this.findById(id))) return null;
    return this.findById(id);
  },
  async removeRole(id, role) {
    const user = await this.findById(id);
    if (!user) return null;
    if (!pool) {
      user.roles = user.roles.filter((item) => item !== role);
      user.updated_at = new Date().toISOString();
      return user;
    }
    await pool.execute(
      "DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.name = ?",
      [id, role],
    );
    return this.findById(id);
  },
  async delete(id) {
    if (!pool) return memoryUsers.delete(id);
    const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },
};

export const publicUser = ({ password_hash, token_version, ...user }) => user;
