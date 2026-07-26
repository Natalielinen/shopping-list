import { z } from "zod";

// Общий Zod-контракт валидации для email/пароля. Одна и та же схема используется
// на клиенте (React Hook Form + zodResolver) и на сервере (Server Action / route
// handler), а типы выводятся через z.infer. Тексты ошибок зафиксированы в
// UI-SPEC (§ Copywriting Contract); минимальная длина пароля — 8 (D-03).

export const registerSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});

export const loginSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(1, "Заполните это поле"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
