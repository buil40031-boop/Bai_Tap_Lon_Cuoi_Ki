document.addEventListener("DOMContentLoaded", async function () {
  // 1. Lấy ID từ URL (Ví dụ: product_detail.html?id=1)
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");

  // 2. Lấy dữ liệu sản phẩm từ API MariaDB
  let allProducts = [];
  try {
    const res = await fetch("http://localhost:3000/api/products");
    allProducts = await res.json();
  } catch (err) {
    console.error("Lỗi không lấy được danh sách sản phẩm từ CSDL:", err);
  }

  if (!allProducts || allProducts.length === 0) {
    console.error("Chưa nạp được dữ liệu sản phẩm!");
    return;
  }

  // 3. Tìm sản phẩm theo ID (Mặc định lấy sản phẩm đầu tiên nếu ID không khớp)
  const product = allProducts.find(p => String(p.id) === String(productId)) || allProducts[0];

  // 4. Lấy danh sách Options (Phân loại) từ CSDL MariaDB cho sản phẩm này
  let productOptions = [];
  try {
    const optRes = await fetch(`http://localhost:3000/api/products/${product.id}/options`);
    productOptions = await optRes.json();
  } catch (err) {
    console.error("Lỗi không lấy được options từ CSDL:", err);
  }

  // 5. Hiển thị thông tin chính của sản phẩm lên HTML
  const imageSrc = product.img || product.image || '/images/default.jpg';
  const mainImg = document.getElementById("main-product-img");
  if (mainImg) {
    mainImg.src = imageSrc;
    mainImg.alt = product.name;
  }

  const nameEl = document.getElementById("product-name");
  if (nameEl) nameEl.innerText = product.name;

  const priceEl = document.getElementById("product-price");
  if (priceEl) priceEl.innerText = product.price ? product.price.toLocaleString("vi-VN") + " VNĐ" : "Liên hệ";

  const usageEl = document.getElementById("product-usage");
  if (usageEl) usageEl.innerText = product.usage || "Đang cập nhật";

  const storageEl = document.getElementById("product-storage");
  if (storageEl) storageEl.innerText = product.storage || "Đang cập nhật";

  const warningEl = document.getElementById("product-warning");
  if (warningEl) warningEl.innerText = product.warning || "Đang cập nhật";

  const descEl = document.getElementById("product-description");
  if (descEl) descEl.innerText = product.description || "Chưa có mô tả chi tiết.";

  // 6. Render các Option (Phân loại) lấy từ CSDL
  const optionsContainer = document.getElementById("product-options");
  if (optionsContainer && productOptions && productOptions.length > 0) {
    optionsContainer.innerHTML = `
      <p><b>Phân loại:</b></p>
      <div class="option-btns">
        ${productOptions.map((opt, i) => `
          <button class="opt-btn ${i === 0 ? 'active' : ''}" data-id="${opt.id}" data-price="${opt.price}" data-name="${opt.name}">
            ${opt.name}
          </button>
        `).join('')}
      </div>
    `;

    const optionDescContainer = document.getElementById("option-descriptions");
    if (optionDescContainer) {
      optionDescContainer.innerHTML = productOptions.map(opt => `
        <p>• <b>${opt.name}:</b> ${opt.description || "Chưa có mô tả chi tiết."}</p>
      `).join('');
    }

    // Cập nhật giá sản phẩm khi bấm chuyển Option
    document.querySelectorAll(".opt-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".opt-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        const selectedPrice = parseInt(this.dataset.price, 10);
        if (priceEl) priceEl.innerText = selectedPrice.toLocaleString("vi-VN") + " VNĐ";
      });
    });
  } else if (optionsContainer) {
    optionsContainer.innerHTML = '';
  }

  // 7. Render danh sách Sản phẩm tương tự (Tối đa 2 sản phẩm khác sản phẩm hiện tại)
  const similarContainer = document.getElementById("similar-products-list");
  if (similarContainer) {
    const similarProducts = allProducts.filter(p => String(p.id) !== String(product.id)).slice(0, 2);

    similarContainer.innerHTML = similarProducts.map(sp => {
      const spImage = sp.img || sp.image || '/images/default.jpg';
      return `
        <div class="product_card" data-id="${sp.id}">
          <div class="card-img">
            <img src="${spImage}" alt="${sp.name}">
          </div>
          <div class="card_content">
            <h3>${sp.name}</h3>
            <p class="product_desc">${sp.description || ''}</p>
            
            <div class="card_price_row">
              <span class="price">${sp.price ? sp.price.toLocaleString("vi-VN") + " VNĐ" : "Liên hệ"}</span>
              <a href="product_detail.html?id=${sp.id}" class="product_properties">Chi tiết</a>
            </div>
          </div>
          <button class="buy_now" onclick="addToCartGlobal('${sp.id}')">Thêm vào giỏ hàng</button>
        </div>
      `;
    }).join('');
  }

  // Cập nhật lại số lượng giỏ hàng trên Navbar
  updateCartCount();

  // 8. XỬ LÝ NÚT LIKE (YÊU THÍCH) VỚI MARIADB
  const likeBtn = document.getElementById("like");
  const currentUserId = sessionStorage.getItem("userId") || 1; // Giả định userId = 1 nếu chưa lưu login

  if (likeBtn) {
    // Kiếm tra trạng thái đã thích từ DB hay chưa khi mới mở trang
    try {
      const favRes = await fetch(`http://localhost:3000/api/favorites/${currentUserId}`);
      const favoriteIds = await favRes.json();
      
      if (favoriteIds.includes(Number(product.id))) {
        likeBtn.classList.add("active");
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách yêu thích:", err);
    }

    // Bấm nút Tim để Thêm/Xóa khỏi DB
    likeBtn.addEventListener("click", async function () {
      if (sessionStorage.getItem("isLoggedIn") !== "true") {
        window.location.href = "login.html";
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/favorites/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUserId,
            productId: product.id
          })
        });

        const data = await response.json();

        if (data.action === "added") {
          likeBtn.classList.add("active");
          showToast(`Đã thêm "${product.name}" vào danh sách yêu thích!`);
        } else if (data.action === "removed") {
          likeBtn.classList.remove("active");
          showToast(`Đã bỏ "${product.name}" khỏi danh sách yêu thích.`);
        }
      } catch (err) {
        console.error("Lỗi toggle yêu thích:", err);
      }
    });
  }

  // 9. XỬ LÝ NÚT "THÊM VÀO GIỎ HÀNG" & "MUA NGAY"
  const addToCartBtn = document.getElementById("plus-to-cart");
  const buyNowBtn = document.getElementById("buy-now");

  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", function () {
      if (sessionStorage.getItem("isLoggedIn") !== "true") {
        alert("Vui lòng đăng nhập để thực hiện chức năng này!");
        window.location.href = "login.html";
        return;
      }
      addToCartCurrentProduct(product, true);
    });
  }

  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", function () {
      if (sessionStorage.getItem("isLoggedIn") !== "true") {
        alert("Vui lòng đăng nhập để thực hiện chức năng này!");
        window.location.href = "login.html";
        return;
      }
      addToCartCurrentProduct(product, false);
      window.location.href = "cart.html";
    });
  }
});

// HÀM HIỂN THỊ TOAST TỰ ẨN
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// HÀM BỔ TRỢ QUẢN LÝ GIỎ HÀNG
function addToCartCurrentProduct(product, showNotification = true) {
  let cart = JSON.parse(localStorage.getItem("CART")) || [];

  const activeOpt = document.querySelector(".opt-btn.active");
  const price = activeOpt ? parseInt(activeOpt.dataset.price, 10) : product.price;
  const optionName = activeOpt ? activeOpt.dataset.name : "";
  const optionId = activeOpt ? activeOpt.dataset.id : null;

  const imageSrc = product.img || product.image || '';
  const cartItemId = optionName ? `${product.id}-${optionName}` : String(product.id);
  const existingItem = cart.find(item => String(item.cartItemId || item.id) === String(cartItemId));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: cartItemId,                         // Dùng cartItemId làm ID định danh trong Cart
      cartItemId: cartItemId,
      product_id: product.id,
      option_id: optionId ? Number(optionId) : null,
      optionId: optionId ? Number(optionId) : null,
      optionName: optionName || "Mặc định",  // 👈 Lưu optionName
      name: product.name,                    // Giữ nguyên tên gốc, không cần cộng chuỗi
      price: price || 0,
      image: imageSrc,
      quantity: 1
    });
  }

  localStorage.setItem("CART", JSON.stringify(cart));
  updateCartCount();

  if (showNotification) {
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
  }
}

// Hàm thêm sản phẩm tương tự vào giỏ
async function addToCartGlobal(productId) {
  if (sessionStorage.getItem("isLoggedIn") !== "true") {
    alert("Vui lòng đăng nhập để thực hiện chức năng này!");
    window.location.href = "login.html";
    return;
  }

  let allProducts = [];
  try {
    const res = await fetch("http://localhost:3000/api/products");
    allProducts = await res.json();
  } catch (err) {
    console.error("Lỗi lấy sản phẩm tương tự:", err);
    return;
  }

  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  const imageSrc = product.img || product.image || '/images/default.jpg';
  let cart = JSON.parse(localStorage.getItem("CART")) || [];
  
  // Định danh sản phẩm không chọn phân loại
  const cartItemId = String(product.id);
  const existingItem = cart.find(item => String(item.cartItemId || item.id) === cartItemId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: cartItemId,
      cartItemId: cartItemId,
      product_id: product.id,
      option_id: null,
      optionId: null,
      optionName: "Mặc định",
      name: product.name,
      price: product.price || 0,
      image: imageSrc,
      quantity: 1
    });
  }

  localStorage.setItem("CART", JSON.stringify(cart));
  updateCartCount();
  showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);

  const cartCountBadge = document.getElementById('cart-count');
  if (!cartCountBadge) return;

  cartCountBadge.textContent = totalCount;
  cartCountBadge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
}
