import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/RegisterForm";

// RSC-оболочка экрана регистрации: рендерит client-leaf `RegisterForm`.
// Сама страница остаётся серверной — интерактивность живёт только в форме.
export const metadata: Metadata = {
  title: "Регистрация — Список покупок",
};

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-8 sm:items-center sm:pt-0">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Регистрация</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </main>
  );
}
