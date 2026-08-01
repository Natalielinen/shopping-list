"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { createItem } from "@/app/(app)/list/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Schema содержит поля с `.default()` (doubts/isCredit) → входной тип формы
// (значения по умолчанию опциональны) расходится с выходным (после валидации все
// заданы). RHF-форма типизируется тремя дженериками: вход, контекст, выход.
type ItemFormInput = z.input<typeof itemInputSchema>;

// Client-leaf форма добавления покупки — точный аналог RegisterForm (единая
// Zod-валидация через zodResolver, mode onSubmit, isSubmitting → pending, Alert
// для форм-левел ошибки, Loader2-спиннер, router.push + refresh при успехе).
//
// TRACER-срез: только ОБЯЗАТЕЛЬНЫЕ поля (title + 4 Select). Необязательные поля
// (link/description/price/deadline/doubts/isCredit/monthlyPayment) добавляются в
// плане 04 — schema уже принимает их значения по умолчанию (never-trust-client).
//
// Русские подписи пунктов Select — локальная label-мапа поверх английских ключей
// scales.ts (единый источник значений; тексты — из SUMMARY/D-01…D-03).

const CATEGORY_OPTIONS: ReadonlyArray<[ItemInput["category"], string]> = [
  ["health", "Здоровье"],
  ["hygiene", "Гигиена"],
  ["study", "Учеба"],
  ["work", "Работа"],
  ["clothing", "Одежда, обувь, аксессуары"],
  ["home", "Дом"],
  ["repair", "Ремонт"],
  ["beauty", "Красота"],
  ["pets", "Животные"],
  ["hobby", "Хобби"],
  ["misc", "Разное"],
  ["entertainment", "Развлечения"],
  ["toys", "Игрушки"],
  ["unnecessary", "Не нужные хотелки"],
];

const URGENCY_OPTIONS: ReadonlyArray<[ItemInput["urgency"], string]> = [
  ["vital", "Жизненно важно"],
  ["extra", "Экстра срочность"],
  ["veryUrgent", "Очень срочно"],
  ["urgent", "Срочно"],
  ["notVeryUrgent", "Не очень срочно"],
  ["notUrgent", "Не срочно"],
];

const NEED_OPTIONS: ReadonlyArray<[ItemInput["need"], string]> = [
  ["neededAndWanted", "И нужно и хочется"],
  ["needed", "Нужно"],
  ["wanted", "Хочется"],
];

const BENEFIT_OPTIONS: ReadonlyArray<[ItemInput["benefit"], string]> = [
  ["income", "Приносит доход"],
  ["savesResources", "Экономит время/деньги/силы"],
  ["noBenefit", "Никаких выгод"],
  ["spendsResources", "Расходует время/деньги/силы"],
  ["overpriced", "Тратит больше, чем стоит"],
];

export function AddItemForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ItemFormInput, unknown, ItemInput>({
    resolver: zodResolver(itemInputSchema),
    defaultValues: { title: "" },
    mode: "onSubmit",
  });

  const isPending = form.formState.isSubmitting;

  async function onSubmit(values: ItemInput) {
    setFormError(null);
    const res = await createItem(values);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    // D-09: навигацию выполняет клиент (action не редиректит, Pitfall 7).
    // Порядок важен: refresh() ДО push() — сбрасывает Router Cache (чтобы /list
    // показал только что добавленную покупку), затем push() навигирует. Обратный
    // порядок (push потом refresh) отменяет навигацию после Server Action.
    router.refresh();
    router.push("/list");
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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="Что купить"
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Категория</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-base">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="urgency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Срочность</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {URGENCY_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-base">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="need"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Необходимость</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {NEED_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-base">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="benefit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Выгода</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BENEFIT_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-base">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-2 grid gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full text-base"
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Добавить покупку
          </Button>
          <Button
            type="button"
            variant="outline"
            asChild
            className="h-11 w-full text-base"
          >
            <Link href="/list">Отмена</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
