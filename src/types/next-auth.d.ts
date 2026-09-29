import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      email: string;
      name: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    /** epoch ms do login — sessões anteriores à última edição do usuário são invalidadas */
    loginEm?: number;
  }
}
