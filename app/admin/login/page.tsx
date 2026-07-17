import { LoginForm } from "@/components/cms/LoginForm";
import { CmsSessionProvider } from "@/components/cms/SessionProvider";

export default function AdminLoginPage() {
  return (
    <CmsSessionProvider>
      <LoginForm />
    </CmsSessionProvider>
  );
}
