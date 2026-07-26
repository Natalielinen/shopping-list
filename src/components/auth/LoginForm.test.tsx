import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const signInEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: (...args: unknown[]) => signInEmail(...args) } },
}));

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    signInEmail.mockReset();
  });

  it("рендерит поля email и пароль с лейблами и кнопку «Войти»", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
  });

  it("не отправляет запрос при пустой обязательной паре и показывает ошибки", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(
      await screen.findByText("Введите корректный email")
    ).toBeInTheDocument();
    expect(screen.getByText("Заполните это поле")).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("блокирует кнопку submit, пока идёт запрос (pending, без двойного submit)", async () => {
    const user = userEvent.setup();
    let resolve!: (v: { error: null }) => void;
    signInEmail.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "password123");

    const button = screen.getByRole("button", { name: "Войти" });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(signInEmail).toHaveBeenCalledTimes(1);
    expect(signInEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });

    resolve({ error: null });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/list"));
  });
});
