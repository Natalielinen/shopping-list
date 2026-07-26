import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Моки навигации и браузерного auth-клиента: компонентный тест изолирован от
// сети и роутера Next. authClient.signUp.email управляем вручную, чтобы
// проверить pending-состояние кнопки.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const signUpEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: (...args: unknown[]) => signUpEmail(...args) } },
}));

import { RegisterForm } from "./RegisterForm";

describe("RegisterForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    signUpEmail.mockReset();
  });

  it("рендерит поля email и пароль с лейблами", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Зарегистрироваться" })
    ).toBeInTheDocument();
  });

  it("показывает «Пароль должен содержать минимум 8 символов» при коротком пароле", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "short");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(
      await screen.findByText("Пароль должен содержать минимум 8 символов")
    ).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("показывает «Введите корректный email» при неверном email", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Пароль"), "password123");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(
      await screen.findByText("Введите корректный email")
    ).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("блокирует кнопку submit, пока идёт запрос (без двойного submit)", async () => {
    const user = userEvent.setup();
    let resolve!: (v: { error: null }) => void;
    signUpEmail.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "password123");

    const button = screen.getByRole("button", { name: "Зарегистрироваться" });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(signUpEmail).toHaveBeenCalledTimes(1);
    expect(signUpEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      name: "user@example.com",
    });

    resolve({ error: null });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/list"));
  });
});
