"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Client-leaf форма регистрации (единственное место с интерактивностью — сами
// страницы/layout остаются RSC, чтобы серверные секреты не попадали в бандл).
// Валидация — общий Zod-контракт (registerSchema) через zodResolver: те же
// правила и тексты, что и на сервере. Успешная регистрация авто-входит
// пользователя (D-04) и ведёт на защищённый список.
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const isPending = form.formState.isSubmitting;

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      // D-01: отображаемое имя не запрашиваем; поле `name` таблицы Better Auth
      // обязательно — подставляем email (в шапке всё равно показываем email).
      name: values.email,
    });

    if (error) {
      // Better Auth возвращает конфликт при занятом email.
      setFormError(
        error.status === 422 || error.code === "USER_ALREADY_EXISTS"
          ? "Этот email уже занят"
          : "Что-то пошло не так. Попробуйте ещё раз."
      );
      return;
    }

    // D-04: авто-вход выполнен Better Auth (сессия создана) — на список.
    router.push("/list");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4"
        noValidate
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 text-base"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="h-11 text-base"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full text-base"
        >
          {isPending ? <Loader2 className="animate-spin" /> : null}
          Зарегистрироваться
        </Button>

        <p className="text-center text-base text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Уже есть аккаунт? Войти
          </Link>
        </p>
      </form>
    </Form>
  );
}
