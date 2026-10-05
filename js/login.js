const loginForm = document.getElementById("login_form");
const registerForm = document.getElementById("register_form");
const forgotForm = document.getElementById("forgot_form");

const toForgot = document.getElementById("to_forgot");
const toRegister = document.getElementById("to_register");
const registerToLogin = document.getElementById("register_to_login");
const forgotToLogin = document.getElementById("forgot_to_login");

const sendForgotPassword = document.getElementById("send_forgot_password");
const forgotInputs = document.getElementById("forgot_inputs");
const sucessMsgBox = document.getElementById("sucess_msg_box");

// --- CHUYỂN ĐỔI QUA LẠI CÁC FORM ---
toForgot?.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  forgotForm.classList.remove("hidden");
});

toRegister?.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

registerToLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

forgotToLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  forgotForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

sendForgotPassword?.addEventListener("click", (e) => {
  e.preventDefault();
  forgotInputs.classList.add("hidden");
  sucessMsgBox.classList.remove("hidden");
});

// 1. XỬ LÝ ĐĂNG KÝ (KẾT NỐI MARIADB VIA API)
registerForm?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const name = document.getElementById("reg_name")?.value.trim() || "";
  const phoneNumber = document.getElementById("reg_phone_number")?.value.trim() || "";
  const email = document.getElementById("reg_email")?.value.trim() || "";
  const password = document.getElementById("reg_password")?.value.trim() || "";
  const repassword = document.getElementById("reg_repassword")?.value.trim() || "";

  if (password !== repassword) {
    alert("Mật khẩu nhập lại không trùng khớp!");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || email, // Dùng name hoặc email làm username trong DB
        phone: phoneNumber,
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Đăng ký thất bại!");
      return;
    }

    alert("Đăng ký thành công! Hãy đăng nhập để tiếp tục.");
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    alert("Không thể kết nối đến máy chủ Backend!");
  }
});

// 2. XỬ LÝ ĐĂNG NHẬP (KẾT NỐI MARIADB VIA API)
loginForm?.addEventListener("submit", async function (e) {
  e.preventDefault();

  const emailInput = document.getElementById("login_email")?.value.trim() || "";
  const passwordInput = document.getElementById("login_password")?.value || "";

  // A. CẤU HÌNH TÀI KHOẢN ADMIN MẶC ĐỊNH
  const ADMIN_EMAIL = "admin@gmail.com";
  const ADMIN_PASSWORD = "admin123";

  if (emailInput === ADMIN_EMAIL && passwordInput === ADMIN_PASSWORD) {
    alert("Đăng nhập tài khoản Quản trị viên (Admin) thành công!");
    
    sessionStorage.setItem("isLoggedIn", "true");
    sessionStorage.setItem("userId", "admin");
    sessionStorage.setItem("currentUser", JSON.stringify({
      id: "admin",
      name: "Quản trị viên",
      email: ADMIN_EMAIL,
      role: "admin"
    }));

    window.location.href = "admin.html";
    return;
  }

  // B. KIỂM TRA ĐĂNG NHẬP USER THƯỜNG QUA API BACKEND
  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput,
        password: passwordInput
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Đăng nhập thất bại, kiểm tra lại thông tin!");
      return;
    }

    alert("Đăng nhập thành công!");

    // Lưu thông tin người dùng vào sessionStorage
    sessionStorage.setItem("isLoggedIn", "true");
    sessionStorage.setItem("userId", data.user.id); // Lưu riêng userId để tiện truy vấn DB
    sessionStorage.setItem("currentUser", JSON.stringify({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: "user"
    }));

    // Chuyển hướng tới trang cá nhân hoặc trang chủ
    window.location.href = "account.html";
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    alert("Không thể kết nối tới máy chủ Backend!");
  }
});