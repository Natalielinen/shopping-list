import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

// RSC-оболочка экрана входа: рендерит client-leaf `LoginForm`.
export const metadata: Metadata = {
  title: "Вход — Список покупок",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-8 sm:items-center sm:pt-0">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Вход</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
