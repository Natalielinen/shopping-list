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

// Хелпер: денежное поле в РУБЛЯХ (цена/платёж) из необязательного Input.
//   - пустая строка → undefined (без preprocess z.coerce.number() дал бы 0, Pitfall 5);
//   - nonnegative — деньги не бывают отрицательными;
//   - finite — отсекаем NaN/Infinity информативным сообщением (IN-03), чтобы они
//     не доехали до INSERT в integer-колонку;
//   - max 21_474_836.47 ₽ — верхняя граница, при которой копейки (×100) ещё
//     помещаются в int4 (2_147_483_647);
//   - ≤2 знаков после запятой — рубли с копейками (BL-01). ВНИМАНИЕ: здесь только
//     ВАЛИДАЦИЯ рублей, БЕЗ перевода в копейки. Схема общая для клиента (RHF
//     zodResolver) и сервера; .transform(×100) применился бы ДВАЖДЫ (RHF + сервер)
//     → ×10000. Перевод рубли→копейки делается РОВНО ОДИН РАЗ на сервере в write-
//     пути (actions.ts), клиент копейки не отправляет. Всегда optional.
const optionalRubles = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce
    .number({ message: "Введите число" })
    .nonnegative("Значение не может быть отрицательным")
    .max(21_474_836.47, "Слишком большое значение")
    .refine((n) => Number.isFinite(n), { message: "Введите число" })
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-4, {
      message: "Не более двух знаков после запятой",
    })
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

// Хелпер: необязательная строка (описание) — пустая или из одних пробелов →
// undefined, чтобы в БД попадал NULL, а не "" (IN-02, консистентно с прочими
// nullable-полями).
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

export const itemInputSchema = z.object({
  title: z.string().trim().min(1, "Заполните это поле"), // trim: строки из пробелов невалидны (WR-02)
  category: z.enum(CATEGORY_VALUES, { message: "Выберите значение" }),
  urgency: z.enum(URGENCY_VALUES, { message: "Выберите значение" }),
  need: z.enum(NEED_VALUES, { message: "Выберите значение" }),
  benefit: z.enum(BENEFIT_VALUES, { message: "Выберите значение" }),
  link: optionalUrl,
  description: optionalText,
  price: optionalRubles, // рубли; сервер переводит в копейки при записи (BL-01)
  deadline: optionalDate,
  doubts: z.enum(DOUBTS_VALUES).default("sure"), // ITEM-05 / D-01
  isCredit: z.boolean().default(false),
  monthlyPayment: optionalRubles, // ВСЕГДА optional (Pitfall 6 — условна лишь видимость)
  // ITEM-06: зависимость от другой своей покупки. Radix Select не допускает пустой
  // value, поэтому UI шлёт sentinel "none" — здесь он (как "" и null) приводится к
  // null. Владение (candidate ∈ свои покупки) и запрет циклов НЕ проверяются здесь:
  // схема синхронна и без доступа к БД — эти проверки живут в Server Action (плана 03).
  dependsOn: z.preprocess(
    (v) => (v === "" || v === "none" || v == null ? null : v),
    z.string().nullable()
  ).optional(),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
