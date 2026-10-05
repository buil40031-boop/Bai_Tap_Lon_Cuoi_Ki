// 0. THÔNG TIN TÀI KHOẢN NGÂN HÀNG (VietQR)
const BANK_ID = "MB"; // Mã ngân hàng
const ACCOUNT_NO = "017207009060"; // Số tài khoản nhận tiền
const ACCOUNT_NAME = "Cong Ty"; // Tên chủ tài khoản

// Biến tạm lưu dữ liệu đơn hàng khi mở Modal
let pendingOrderData = null;

// 1. KIỂM TRA ĐĂNG NHẬP
const isLoggedIn = sessionStorage.getItem('isLoggedIn');

if (isLoggedIn !== 'true') {
  const currentPath = window.location.pathname;
  const newPath = currentPath.substring(0, currentPath.lastIndexOf('/')) + '/login.html';
  window.location.href = newPath;
}

// 2. HÀM LẤY DANH SÁCH YÊU THÍCH TỪ DATABASE (API)
async function getFavoriteProductIds() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {};
  const userId = currentUser.id || currentUser.user_id || currentUser._id || sessionStorage.getItem('userId');
  const token = sessionStorage.getItem('token');

  let favoriteIds = [];

  // 2. Lấy từ Database API
  if (userId || token) {
    try {
      const response = await fetch(`http://localhost:3000/api/favorites?userId=${userId || ''}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (response.ok) {
        const dbFavorites = await response.json();
        if (Array.isArray(dbFavorites)) {
          const dbIds = dbFavorites.map(item => 
            String(typeof item === 'object' ? (item.product_id || item.productId || item.id) : item)
          );
          // Gộp danh sách ID từ DB và LocalStorage (loại bỏ trùng)
          favoriteIds = Array.from(new Set([...favoriteIds, ...dbIds]));
        }
      }
    } catch (err) {
      console.warn("Chưa gọi được API Yêu thích từ Database, dùng dữ liệu LocalStorage:", err);
    }
  }

  return favoriteIds;
}

// 3. HÀM RENDER DỮ LIỆU GIỎ HÀNG
async function renderCartItems() {
  const cartList = document.querySelector(".cart-list");
  if (!cartList) return;

  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div style="text-align: center; padding: 40px; background: #fff; border-radius: 20px;">
        <p style="font-size: 18px; color: #666; margin-bottom: 15px;">Giỏ hàng của bạn đang trống!</p>
        <a href="../html/product.html" style="color: #d32f2f; font-weight: bold; text-decoration: none;">Quay lại mua sắm</a>
      </div>
    `;
    return;
  }

  const dbFavoriteIds = await getFavoriteProductIds();

  cartList.innerHTML = cart.map(item => {
    const itemPrice = parseFloat(item.price || item.newPrice || item.oldPrice) || 0;
    const itemName = item.name || item.title || "Sản phẩm Yến";
    const itemImg = item.image || item.img || 'https://via.placeholder.com/80';
    const itemQty = parseInt(item.quantity) || 1;
    const displayOption = item.optionName || "Mặc định"; // 👈 Lấy optionName động
    const itemId = item.cartItemId || item.id;          // 👈 Định danh duy nhất cho từng phân loại

    const possibleIds = [
      String(item.product_id),
      String(item.productId),
      String(item.id)
    ];

    const isFavorite = possibleIds.some(id => id && id !== 'undefined' && dbFavoriteIds.includes(id)) || item.isFavorite === true;

    const favoriteBadge = isFavorite 
      ? `<span class="badge-favorite" style="background-color: #d32f2f; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: 600; display: inline-block;">Yêu thích</span>` 
      : '';

    return `
      <div class="cart-item-card" data-id="${itemId}">
        <div class="shop-title" style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="item-checkbox" onchange="handleItemCheck()">
          ${favoriteBadge}
          <span class="shop-name" style="font-weight: 600;">Yến Sào Ensure Nest Premium</span>
        </div>
        <div class="item-main">
          <div class="col col-check"></div>
          <div class="col col-product product-info">
            <img src="${itemImg}" alt="${itemName}">
            <div class="product-details">
              <h4 class="product-name">${itemName}</h4>
              <div class="product-variation">
                Phân loại: <span>${displayOption}</span>  <!-- 👈 Hiển thị phân loại chuẩn -->
              </div>
            </div>
          </div>
          <div class="col col-price">
            <span class="price-val" data-price="${itemPrice}">${formatVND(itemPrice)}</span>
          </div>
          <div class="col col-qty">
            <div class="quantity-control">
              <button class="btn-qty minus" onclick="changeQuantity('${itemId}', -1)">-</button> <!-- 👈 Truyền itemId duy nhất -->
              <input type="text" class="qty-input" value="${itemQty}" readonly>
              <button class="btn-qty plus" onclick="changeQuantity('${itemId}', 1)">+</button>  <!-- 👈 Truyền itemId duy nhất -->
            </div>
          </div>
          <div class="col col-total">
            <span class="item-total-price">${formatVND(itemPrice * itemQty)}</span>
          </div>
          <div class="col col-action">
            <button class="btn-delete" onclick="removeItem('${itemId}')"><i class="far fa-trash-alt"></i> Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateCartTotal();
}

// 4. CÁC HÀM XỬ LÝ SỰ KIỆN GIỎ HÀNG
function changeQuantity(cartItemId, delta) {
  let cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const item = cart.find(p => String(p.cartItemId || p.id) === String(cartItemId));

  if (item) {
    item.quantity = (parseInt(item.quantity) || 1) + delta;
    if (item.quantity < 1) item.quantity = 1;

    localStorage.setItem('CART', JSON.stringify(cart));
    renderCartItems();
  }
}

function removeItem(cartItemId) {
  let cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(p => String(p.cartItemId || p.id) !== String(cartItemId));

  localStorage.setItem('CART', JSON.stringify(cart));
  renderCartItems();
}

function handleItemCheck() {
  const itemCheckboxes = document.querySelectorAll(".item-checkbox");
  const selectAll = document.getElementById("selectAll");

  if (selectAll && itemCheckboxes.length > 0) {
    const allChecked = Array.from(itemCheckboxes).every(cb => cb.checked);
    selectAll.checked = allChecked;
  }

  updateCartTotal();
}

function updateCartTotal() {
  let grandTotal = 0;
  let selectedCount = 0;

  const itemCheckboxes = document.querySelectorAll(".item-checkbox");
  const totalItemsCountEl = document.getElementById("totalItemsCount");
  const grandTotalPriceEl = document.getElementById("grandTotalPrice");
  const selectedCountEl = document.getElementById("selectedCount");

  if (totalItemsCountEl) {
    totalItemsCountEl.innerText = itemCheckboxes.length;
  }

  document.querySelectorAll(".cart-item-card").forEach(card => {
    const checkbox = card.querySelector(".item-checkbox");
    const priceEl = card.querySelector(".price-val");
    const qtyInput = card.querySelector(".qty-input");

    if (checkbox && priceEl && qtyInput) {
      const price = parseFloat(priceEl.getAttribute("data-price")) || 0;
      const qty = parseInt(qtyInput.value) || 0;

      if (checkbox.checked) {
        grandTotal += price * qty;
        selectedCount += qty;
      }
    }
  });

  if (grandTotalPriceEl) grandTotalPriceEl.innerText = formatVND(grandTotal);
  if (selectedCountEl) selectedCountEl.innerText = selectedCount;
}

function formatVND(amount) {
  return amount ? amount.toLocaleString('vi-VN') + 'đ' : '0đ';
}

// 5. XỬ LÝ MUA HÀNG & HIỂN THỊ MODAL THANH TOÁN
async function handleCheckout() {
  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const checkedBoxes = document.querySelectorAll(".item-checkbox:checked");

  if (checkedBoxes.length === 0) {
    alert("Vui lòng chọn ít nhất một sản phẩm để đặt hàng!");
    return;
  }

  const selectedItems = [];
  let grandTotal = 0;

  checkedBoxes.forEach(cb => {
    const card = cb.closest(".cart-item-card");
    const productId = card.dataset.id;
    const qtyInput = card.querySelector(".qty-input");
    const qty = parseInt(qtyInput ? qtyInput.value : 1, 10);

    const itemInCart = cart.find(p => String(p.id) === String(productId));
    if (itemInCart) {
      const price = parseFloat(itemInCart.price || itemInCart.newPrice || itemInCart.oldPrice) || 0;
      selectedItems.push({
        product_id: itemInCart.product_id || itemInCart.productId || itemInCart.id,
        option_id: itemInCart.option_id || itemInCart.optionId || null,
        cart_item_id: itemInCart.id,
        name: itemInCart.name || itemInCart.title || "Sản phẩm Yến Sào",
        price: price,
        quantity: qty
      });
      grandTotal += price * qty;
    }
  });

  // Lấy thông tin user hiện tại từ LocalStorage
  const currentUserLocal = JSON.parse(sessionStorage.getItem('currentUser')) || {};
  const userId = currentUserLocal.id || currentUserLocal.user_id || currentUserLocal._id || sessionStorage.getItem('userId');
  const token = sessionStorage.getItem('token');

  // Khởi tạo các thông tin mặc định
  let customerName = currentUserLocal.fullname || currentUserLocal.name || "Khách hàng";
  let userEmail = currentUserLocal.email || "";
  let userPhone = currentUserLocal.phone || "";
  let userAddress = currentUserLocal.address || "";

  // 🌟 GỌI API LẤY THÔNG TIN MỚI NHẤT TỪ DATABASE TỪ BẢNG USERS
  if (userId) {
    try {
      const res = await fetch(`http://localhost:3000/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });
      if (res.ok) {
        const dbUser = await res.json();
        customerName = dbUser.name || dbUser.fullname || customerName;
        userEmail = dbUser.email || userEmail;
        userPhone = dbUser.phone || userPhone;

        // Tự động ghép địa chỉ chi tiết từ các cột address, ward, city, country
        const addressParts = [
          dbUser.address,
          dbUser.ward,
          dbUser.city,
          dbUser.country
        ].filter(Boolean);

        if (addressParts.length > 0) {
          userAddress = addressParts.join(', ');
        }
      }
    } catch (err) {
      console.warn("Không thể lấy thông tin user trực tiếp từ DB, sẽ dùng thông tin LocalStorage:", err);
    }
  }

  // Fallback nếu vẫn trống địa chỉ
  if (!userAddress) {
    userAddress = "Chưa cập nhật địa chỉ";
  }

  const orderCode = 'ORD' + Math.floor(100000 + Math.random() * 900000);

  // Chuẩn hóa dữ liệu đơn hàng với Phone và Address chuẩn từ DB
  pendingOrderData = {
    order_code: orderCode,
    user_id: userId ? parseInt(userId) : null,
    customer_name: customerName,
    email: userEmail,
    phone: userPhone,
    address: userAddress,
    total_price: grandTotal,
    payment_method: 'COD',
    items: selectedItems,
  };

  const description = `Thanh toan ${orderCode}`;
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${grandTotal}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const qrImg = document.getElementById("qrImage");
  const qrOrderCode = document.getElementById("qrOrderCode");

  if (qrImg) qrImg.src = qrUrl;
  if (qrOrderCode) qrOrderCode.innerText = `${orderCode} (Số tiền: ${formatVND(grandTotal)})`;

  const paymentModal = document.getElementById("paymentModal");
  if (paymentModal) paymentModal.style.display = "flex";
}

// 6. KHỞI TẠO VÀ GẮN SỰ KIỆN KHI TRANG TẢI XONG
document.addEventListener("DOMContentLoaded", function () {
  renderCartItems();

  const selectAll = document.getElementById("selectAll");
  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
  const checkoutBtn = document.querySelector(".btn-checkout");

  const paymentModal = document.getElementById("paymentModal");
  const closeModalBtn = document.getElementById("closePaymentModal");
  const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  const qrContainer = document.getElementById("qrCodeContainer");

  selectAll?.addEventListener("change", function () {
    const itemCheckboxes = document.querySelectorAll(".item-checkbox");
    itemCheckboxes.forEach(cb => cb.checked = this.checked);
    updateCartTotal();
  });

  deleteSelectedBtn?.addEventListener("click", function () {
    let cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
    const checkedBoxes = document.querySelectorAll(".item-checkbox:checked");

    checkedBoxes.forEach(cb => {
      const card = cb.closest(".cart-item-card");
      const productId = card.dataset.id;
      cart = cart.filter(item => String(item.id) !== String(productId));
      card.remove();
    });

    localStorage.setItem('CART', JSON.stringify(cart));
    if (selectAll) selectAll.checked = false;
    updateCartTotal();
  });

  checkoutBtn?.addEventListener("click", handleCheckout);

  closeModalBtn?.addEventListener("click", () => {
    if (paymentModal) paymentModal.style.display = "none";
  });

  paymentRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      if (qrContainer) {
        qrContainer.style.display = (this.value === "online") ? "block" : "none";
      }
    });
  });

// Xác nhận Đặt hàng từ Modal -> Gửi về Backend Database
  confirmPaymentBtn?.addEventListener("click", async function () {
    if (!pendingOrderData) return;

    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    pendingOrderData.payment_method = (selectedMethod === "online") ? "QR" : "COD";

    try {
      // 1. Gửi đơn hàng lên backend API để lưu Database
      const response = await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(pendingOrderData)
      });

      const resData = await response.json();

      if (!response.ok) {
        alert("Lỗi lưu đơn hàng: " + (resData.error || resData.message));
        return; // DỪNG LẠI nếu có lỗi từ Database
      }

      console.log("Lưu đơn hàng vào Database thành công:", resData);

      // 2. Lưu dự phòng ở LocalStorage khi DB lưu thành công
      const existingOrders = JSON.parse(localStorage.getItem('orders')) || [];
      existingOrders.unshift(pendingOrderData);
      localStorage.setItem('orders', JSON.stringify(existingOrders));

      // 3. Cập nhật xóa các sản phẩm đã mua khỏi giỏ hàng
      const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
      const remainingCart = cart.filter(cartItem => 
        !pendingOrderData.items.some(selected => String(selected.cart_item_id) === String(cartItem.id))
      );
      localStorage.setItem('CART', JSON.stringify(remainingCart));

      // 4. Thông báo và chuyển hướng
      alert("Đặt hàng thành công!");
      window.location.href = "../html/account.html?page=cart";

    } catch (err) {
      console.error("Lỗi kết nối Server khi đặt hàng:", err);
      alert("Không thể kết nối tới server backend!");
    }
  });
});