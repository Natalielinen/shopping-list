import { z } from "zod";

import {
  BENEFIT_VALUES,
  CATEGORY_VALUES,
  DOUBTS_VALUES,
  NEED_VALUES,
  URGENCY_VALUES,
} from "@/lib/scoring/scales";

// Единый Zod-контракт покупки (клиент + сервер), зеркалит auth.ts: одна z.object,
// тип через z.infer, русские тексты ошибок дословно из UI-SPEC §Copywriting
// Contract. Значения enum импортируются из scoring/scales — единый источник истины
// (не дублируем список ключей). Та же схема повторно вызывается на сервере в
// Server Action плана 03 (never-trust-client, V5).

// Хелпер: пустая строка из необязательного числового Input → undefined, иначе
// coerce в число. Без preprocess z.coerce.number() превращает "" в 0 (Pitfall 5).
// nonnegative — цена/платёж не бывают отрицательными; всегда optional.
const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce
    .number({ message: "Введите число" })
    .nonnegative("Значение не может быть отрицательным")
    .optional()
);

// Хелпер: пустая строка необязательной ссылки → undefined, иначе валидируется как
// url с текстом ошибки из UI-SPEC.
const optionalUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.url("Введите корректную ссылку").optional()
);

// Хелпер: пустая строка необязательной даты → undefined, иначе coerce в Date.
const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.date().optional()
);

export const itemInputSchema = z.object({
  title: z.string().trim().min(1, "Заполните это поле"), // trim: строки из пробелов невалидны (WR-02)
  category: z.enum(CATEGORY_VALUES, { message: "Выберите значение" }),
  urgency: z.enum(URGENCY_VALUES, { message: "Выберите значение" }),
  need: z.enum(NEED_VALUES, { message: "Выберите значение" }),
  benefit: z.enum(BENEFIT_VALUES, { message: "Выберите значение" }),
  link: optionalUrl,
  description: z.string().optional(),
  price: optionalNumber,
  deadline: optionalDate,
  doubts: z.enum(DOUBTS_VALUES).default("sure"), // ITEM-05 / D-01
  isCredit: z.boolean().default(false),
  monthlyPayment: optionalNumber, // ВСЕГДА optional (Pitfall 6 — условна лишь видимость)
});

export type ItemInput = z.infer<typeof itemInputSchema>;
