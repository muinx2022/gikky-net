import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const providers = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }))
}

export const { handlers, auth } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/${account.provider}/callback?access_token=${account.access_token}`
        )
        const data = await res.json()
        if (data.jwt) {
          token.strapiJwt = data.jwt
          token.strapiUser = data.user
        }
      }
      return token
    },
    async session({ session, token }) {
      session.strapiJwt = token.strapiJwt as string
      session.strapiUser = token.strapiUser as any
      return session
    },
  },
})
