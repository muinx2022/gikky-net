import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
    }),
  ],
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
