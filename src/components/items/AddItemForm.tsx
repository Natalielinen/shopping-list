"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { createItem, type CreateItemResult } from "@/app/(app)/list/new/actions";
import { updateItem } from "@/app/(app)/list/[id]/edit/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

const DOUBTS_OPTIONS: ReadonlyArray<[ItemInput["doubts"], string]> = [
  ["sure", "Уверен(а)"], // 0 очков (D-01) — default
  ["doubt", "Сомневаюсь"], // −1
  ["strongDoubt", "Сильно сомневаюсь"], // −3
];

// Единая форма add/edit (D-01). В create-режиме (по умолчанию) поля пусты и
// submit вызывает createItem; в edit-режиме форма предзаполнена `initialValues`
// (RSC-обёртка отдаёт значения покупки: цена/платёж уже в рублях, ÷100 из копеек),
// submit вызывает updateItem(itemId, …). Различаются только submit-лейбл, текст
// ошибки и целевой Server Action — всё остальное идентично (единая Zod-валидация).
export function AddItemForm({
  mode = "create",
  itemId,
  initialValues,
}: {
  mode?: "create" | "edit";
  itemId?: string;
  initialValues?: Partial<ItemFormInput>;
} = {}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = mode === "edit";
  const EDIT_SAVE_ERROR = "Не удалось сохранить изменения. Попробуйте ещё раз.";

  const form = useForm<ItemFormInput, unknown, ItemInput>({
    resolver: zodResolver(itemInputSchema),
    // doubts/isCredit заданы явно (не полагаемся на schema `.default()` для
    // первого рендера): Select сразу показывает «Уверен(а)», чекбокс — снят.
    // В edit-режиме `initialValues` (из покупки) переопределяют дефолты.
    defaultValues: { title: "", doubts: "sure", isCredit: false, ...initialValues },
    mode: "onSubmit",
  });

  const isPending = form.formState.isSubmitting;
  // Видимость monthlyPayment зависит от чекбокса isCredit (ITEM-04). watch
  // подписывает компонент на изменение значения → условный рендер ниже.
  const isCredit = form.watch("isCredit");

  async function onSubmit(values: ItemInput) {
    setFormError(null);
    // WR-02: monthlyPayment имеет смысл только при isCredit. Из-за
    // shouldUnregister:false скрытое поле сохраняет значение (например при
    // противоречивом initialValues isCredit=false + monthlyPayment из прошлого
    // состояния), а onCheckedChange-хендлер не срабатывает, если чекбокс не
    // трогали. Принудительно очищаем платёж на submit, когда покупка не в кредит,
    // чтобы устаревшее число никогда не ушло на сервер без кредита.
    const payload: ItemInput = values.isCredit
      ? values
      : { ...values, monthlyPayment: undefined };
    // create/updateItem могут РЕДЖЕКТНУТЬСЯ (истёкшая сессия → requireUser()
    // бросает до try/catch экшена; сетевой сбой Server Action). Оборачиваем в
    // try/catch, чтобы показать форм-левел Alert вместо необработанного reject
    // (IN-01). В edit-режиме вызывается updateItem(itemId, …); текст ошибки —
    // «…сохранить изменения…» (UI-SPEC отличается от create-копии).
    let res: CreateItemResult;
    try {
      res = isEdit
        ? await updateItem(itemId!, payload)
        : await createItem(payload);
    } catch {
      setFormError(
        isEdit ? EDIT_SAVE_ERROR : "Не удалось сохранить покупку. Попробуйте ещё раз."
      );
      return;
    }
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

        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ссылка</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://"
                  className="h-11 text-base"
                  {...field}
                  value={(field.value as string | undefined) ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Заметка о покупке"
                  className="text-base"
                  {...field}
                  value={(field.value as string | undefined) ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цена</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="h-11 text-base"
                  {...field}
                  value={(field.value as string | undefined) ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Срок</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className="h-11 text-base"
                  {...field}
                  value={(field.value as string | undefined) ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="doubts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сомнения</FormLabel>
              <Select defaultValue={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 w-full text-base">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DOUBTS_OPTIONS.map(([value, label]) => (
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
          name="isCredit"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    // Pitfall 6: при снятии isCredit скрытое поле monthlyPayment
                    // очищается, чтобы submit не отправил ранее введённое число.
                    if (!checked) {
                      form.setValue("monthlyPayment", undefined);
                    }
                  }}
                />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer">
                Покупка в кредит
              </FormLabel>
            </FormItem>
          )}
        />

        {/* Условная видимость monthlyPayment (ITEM-04): рендерится только при
            isCredit; поле схемы всегда optional (условна лишь видимость). */}
        {isCredit ? (
          <FormField
            control={form.control}
            name="monthlyPayment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ежемесячный платёж</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    className="h-11 text-base"
                    {...field}
                    value={(field.value as string | undefined) ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="mt-2 grid gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full text-base"
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? "Сохранить" : "Добавить покупку"}
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
