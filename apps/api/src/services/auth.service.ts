import bcrypt from 'bcryptjs'
import { db, eq, users } from '@smart-city/database'
import type { FastifyInstance } from 'fastify'

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(email: string, password: string, name: string, role: string) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      throw { statusCode: 409, message: 'Email already registered' }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role: role as 'ADMIN' | 'DISPATCHER' | 'ANALYST' | 'VIEWER',
    }).returning()

    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  async login(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      throw { statusCode: 401, message: 'Invalid email or password' }
    }

    if (!user.isActive) {
      throw { statusCode: 403, message: 'Account is deactivated' }
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw { statusCode: 401, message: 'Invalid email or password' }
    }

    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id))

    const token = this.fastify.jwt.sign({
      sub: user.id,
      role: user.role,
      email: user.email,
    })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }

  async getProfile(userId: string) {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1)

    if (!user) {
      throw { statusCode: 404, message: 'User not found' }
    }

    return user
  }
}
