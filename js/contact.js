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

  // Khởi chạy cập nhật giỏ hàng khi trang load
  updateCartCountBadge();
});

const autoResizeTextArea = document.getElementById('auto_size_textarea');
autoResizeTextArea?.addEventListener('input', function(){
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
});

const contactForm = document.querySelector('.input_msg');
const content = document.getElementById('content');
const noticeSuccess = document.getElementById('notice_sucess');

contactForm?.addEventListener('submit', (e) => {
  e.preventDefault(); // Ngăn trang web bị reload lại khi submit
  
  content?.classList.add('hidden'); // Ẩn toàn bộ khối content
  noticeSuccess?.classList.remove('hidden'); // Hiện thông báo thành công
});

// CẬP NHẬT SỐ LƯỢNG GIỎ HÀNG TRÊN NAVBAR
function updateCartCountBadge() {
  // Kiểm tra cả 2 trường hợp đặt tên key LocalStorage ('CART' hoặc 'cart')
  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  
  // Tính tổng số lượng tất cả mặt hàng trong giỏ
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
  
  // SỬA TẠI ĐÂY: Trỏ trực tiếp vào id="cart-count" đã có sẵn trong HTML
  const cartCountBadge = document.getElementById('cart-count');
  if (!cartCountBadge) return;

  // Cập nhật số lượng
  cartCountBadge.textContent = totalCount;

  // Ẩn badge nếu giỏ hàng trống (count = 0)
  if (totalCount > 0) {
    cartCountBadge.style.display = 'inline-flex';
  } else {
    cartCountBadge.style.display = 'none';
  }
}

// Lắng nghe sự kiện thay đổi LocalStorage giữa các tab/trang
window.addEventListener('storage', updateCartCountBadge);