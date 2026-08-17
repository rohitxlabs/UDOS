import { redirect } from "next/navigation";
import { decrypt, getSessionCookie } from "@/lib/auth/session";

export default async function RootPage() {
  const token = await getSessionCookie();
  const session = await decrypt(token);
  redirect(session ? "/dashboard" : "/login");
}
