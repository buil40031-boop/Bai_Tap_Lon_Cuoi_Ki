document.addEventListener("DOMContentLoaded", () => {
  const accountBtn = document.getElementById("account");

  accountBtn?.addEventListener("click", (e) => {
    e.preventDefault();

    // Lấy trạng thái đăng nhập từ LocalStorage
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");

    if (isLoggedIn === "true") {
      // Đã đăng nhập -> Nhảy vào trang tài khoản
      window.location.href = "account.html";
    } else {
      // Chưa đăng nhập -> Nhảy vào trang đăng nhập
      window.location.href = "login.html";
    }
  });
});