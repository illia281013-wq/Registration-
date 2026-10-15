import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

  // Эти два значения не являются service_role секретами. Вставь Project URL
  // и publishable/anon key из Supabase Dashboard → Project Settings → API.
  // Защиту данных обеспечивает RLS в schema.sql, а не сокрытие publishable key.
  const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
  const SUPABASE_PUBLISHABLE_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE";
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)
    && !SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_")
    && SUPABASE_PUBLISHABLE_KEY.length > 20;

  const $ = (id) => document.getElementById(id);
  const authCard = $("authCard"), profileCard = $("profileCard");
  const authForm = $("authForm"), authMessage = $("message"), profileMessage = $("profileMessage");
  let supabase = null, mode = "signup", currentUser = null;

  function say(element, text, kind = "info") {
    element.textContent = text;
    element.className = "message show " + kind;
  }
  function clear(element) { element.textContent = ""; element.className = "message"; }
  function busy(button, state, label) {
    button.disabled = state;
    if (state) { button.dataset.oldLabel = button.textContent; button.textContent = label; }
    else if (button.dataset.oldLabel) { button.textContent = button.dataset.oldLabel; delete button.dataset.oldLabel; }
  }
  function setMode(next) {
    mode = next;
    $("formTitle").textContent = mode === "signup" ? "Создать аккаунт" : "Войти";
    $("nameField").hidden = mode !== "signup";
    $("displayName").required = mode === "signup";
    $("password").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("submitButton").textContent = mode === "signup" ? "Зарегистрироваться" : "Войти";
    $("switchText").textContent = mode === "signup" ? "Уже есть аккаунт?" : "Нет аккаунта?";
    $("switchMode").textContent = mode === "signup" ? "Войти" : "Создать аккаунт";
    clear(authMessage);
  }
  $("switchMode").addEventListener("click", () => setMode(mode === "signup" ? "login" : "signup"));
  document.querySelectorAll(".toggle").forEach((button) => button.addEventListener("click", () => {
    const input = $(button.dataset.target), show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Скрыть" : "Показать";
    button.setAttribute("aria-pressed", String(show));
  }));

  async function loadProfile(user) {
    currentUser = user;
    authCard.hidden = true;
    profileCard.hidden = false;
    $("userId").textContent = user.id;
    $("userEmail").textContent = user.email || "—";
    $("profileName").value = user.user_metadata?.display_name || "";
    $("createdAt").textContent = user.created_at ? new Date(user.created_at).toLocaleString("ru-RU") : "—";
    clear(profileMessage);

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      say(profileMessage, "Не удалось загрузить профиль. Проверь, что применён schema.sql и включены RLS-политики.", "error");
      return;
    }
    if (!data) {
      say(profileMessage, "Профиль ещё не создан. Проверь SQL-триггер из schema.sql и настройки подтверждения email.", "error");
      return;
    }
    $("profileName").value = data.display_name || "";
    $("createdAt").textContent = data.created_at ? new Date(data.created_at).toLocaleString("ru-RU") : "—";
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clear(authMessage);
    if (!configured || !supabase) {
      say(authMessage, "Сначала создай проект Supabase и вставь Project URL и publishable/anon key в index.html. Не используй service_role key.", "error");
      return;
    }
    const email = $("email").value.trim();
    const password = $("password").value;
    const displayName = $("displayName").value.trim();
    if (!email || !$("email").validity.valid) {
      say(authMessage, "Введи корректный адрес электронной почты.", "error"); $("email").focus(); return;
    }
    if (mode === "signup" && !displayName) {
      say(authMessage, "Введи имя для профиля.", "error"); $("displayName").focus(); return;
    }
    if (mode === "signup" && password.length < 12) {
      say(authMessage, "Пароль должен содержать не менее 12 символов.", "error"); $("password").focus(); return;
    }
    const submit = $("submitButton");
    busy(submit, true, "Подожди…");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: displayName } }
        });
        if (error) throw error;
        if (data.session && data.user) {
          await loadProfile(data.user);
        } else {
          say(authMessage, "Регистрация отправлена. Проверь почту и подтверди адрес, затем войди.", "ok");
          authForm.reset();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await loadProfile(data.user);
      }
    } catch (error) {
      // Не выводим токены, пароли или внутренние детали в интерфейс.
      say(authMessage, error?.message || "Не удалось выполнить запрос. Попробуй ещё раз.", "error");
    } finally {
      busy(submit, false);
      $("password").value = "";
    }
  });

  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clear(profileMessage);
    if (!supabase || !currentUser) return;
    const display_name = $("profileName").value.trim();
    if (!display_name || display_name.length > 80) {
      say(profileMessage, "Имя должно содержать от 1 до 80 символов.", "error"); return;
    }
    const button = event.submitter;
    busy(button, true, "Сохраняю…");
    try {
      const { error } = await supabase.from("profiles")
        .update({ display_name })
        .eq("id", currentUser.id);
      if (error) throw error;
      say(profileMessage, "Имя сохранено.", "ok");
    } catch (error) {
      say(profileMessage, "Не удалось сохранить профиль. Проверь RLS и SQL-настройку.", "error");
    } finally {
      busy(button, false);
    }
  });

  $("logoutButton").addEventListener("click", async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) { say(profileMessage, "Не удалось завершить сеанс.", "error"); return; }
    currentUser = null;
    profileCard.hidden = true;
    authCard.hidden = false;
    authForm.reset();
    setMode("login");
    say(authMessage, "Ты вышел из аккаунта.", "ok");
  });

  if (configured) {
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user);
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        currentUser = null; profileCard.hidden = true; authCard.hidden = false;
      }
    });
  } else {
    say(authMessage, "Подключение базы ещё не настроено. Открой README.md и выполни шаги настройки Supabase.", "info");
  }
