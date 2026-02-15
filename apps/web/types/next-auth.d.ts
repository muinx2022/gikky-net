import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    strapiJwt?: string
    strapiUser?: {
      id: number
      username: string
      email: string
      [key: string]: any
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    strapiJwt?: string
    strapiUser?: {
      id: number
      username: string
      email: string
      [key: string]: any
    }
  }
}
