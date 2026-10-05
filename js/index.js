// lưu trữ tạm thời danh sách sản phẩm lấy từ API
let globalProductsList = [];

// 1. KHỞI TẠO KHI TRANG TẢI XONG
document.addEventListener("DOMContentLoaded", async () => {
  await loadAndRenderProducts();
  updateCartCount();
  setupAccountRedirect();
  setupAddToCartEvents();
});

// 2. HÀM LẤY DỮ LIỆU TỪ BACKEND MARIADB
async function getProductData() {
    const response = await fetch("http://localhost:3000/api/products");
    if (!response.ok) throw new Error("Lỗi tải sản phẩm từ server");
    
    const data = await response.json();
    globalProductsList = data; // Lưu lại danh sách sản phẩm toàn cục
    return data;
}

// 3. HÀM RENDER SẢN PHẨM THEO CATEGORY
async function loadAndRenderProducts() {
  const allProducts = await getProductData();

  if (!allProducts || allProducts.length === 0) {
    console.error("Không tìm thấy dữ liệu sản phẩm!");
    return;
  }

  const grids = document.querySelectorAll('.product-grid');

  grids.forEach(grid => {
    const category = grid.dataset.category;

    // Lọc theo category
    let filteredProducts = allProducts.filter(p => p.category === category);

    // Trường hợp danh mục "banchay" / "bestseller"
    if (category === 'bestseller') {
      filteredProducts = allProducts.filter(p => p.category === 'bestseller' || p.sold >= 30);
    }

    grid.innerHTML = filteredProducts.map(product => {
      let rawImg = product.img || product.image || '';
      
      if (rawImg.startsWith('../')) {
        rawImg = rawImg.replace('../', './');
      } else if (!rawImg) {
        rawImg = './images/default.jpg';
      }

      const imageSrc = rawImg;

      return `
        <div class="product_card" data-id="${product.id}">
          <div class="card-img">
            <img src="${imageSrc}" alt="${product.name}">
          </div>
          <div class="card_content">
            <h3>${product.name}</h3>
            <p class="product_desc">${product.description || ''}</p>
            
            <div class="card_price_row">
              <span class="price">${formatCurrency(product.price)}</span>
              <a href="./html/product_detail.html?id=${product.id}" class="product_properties">Chi tiết</a>
            </div>
          </div>
          <button class="buy_now">Thêm vào giỏ hàng</button>
        </div>
      `;
    }).join('');
  });
}

// 4. HÀM XỬ LÝ GIỎ HÀNG
function setupAddToCartEvents() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("buy_now")) {
      const card = e.target.closest(".product_card");
      if (!card) return;

      const productId = parseInt(card.dataset.id, 10);
      addToCart(productId);
    }
  });
}

function addToCart(productId) {
  // 1. KIỂM TRA ĐĂNG NHẬP
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");

  if (isLoggedIn !== "true") {
    alert("Vui lòng đăng nhập để thực hiện chức năng này!");
    window.location.href = "./html/login.html";
    return;
  }

  // 2. TÌM SẢN PHẨM TRONG DANH SÁCH
  const product = globalProductsList.find(p => p.id == productId);
  if (!product) {
    alert("Không tìm thấy thông tin sản phẩm!");
    return;
  }

  // Lấy ảnh chuẩn để lưu vào giỏ hàng
  let productImg = product.img || product.image || '';
  if (productImg.startsWith('../')) {
    productImg = productImg.replace('../', './');
  }

  // 3. THÊM VÀO GIỎ HÀNG (LOCALSTORAGE)
  let cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const existingItem = cart.find(item => item.id == productId);

  if (existingItem) {
    existingItem.quantity = (parseInt(existingItem.quantity) || 1) + 1;
  } else {
    cart.push({
      id: product.id,
      product_id: product.id,
      name: product.name || "Tên sản phẩm",
      price: parseFloat(product.price) || 0,
      image: productImg,
      quantity: 1
    });
  }

  localStorage.setItem('CART', JSON.stringify(cart));
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

window.addEventListener('storage', updateCartCount);

// 5. UTILITIES & UI
function formatCurrency(amount) {
  const numericAmount = Number(amount);
  return !isNaN(numericAmount) && numericAmount > 0 
    ? numericAmount.toLocaleString('vi-VN') + ' VNĐ' 
    : 'Liên hệ';
}

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

function setupAccountRedirect() {
  const accountBtn = document.getElementById("account");
  accountBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    window.location.href = (isLoggedIn === "true") ? "./html/account.html" : "./html/login.html";
  });
}

// 6. NÚT BACK TO TOP
const backToTopBtn = document.getElementById("backToTop");
if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add("show");
    } else {
      backToTopBtn.classList.remove("show");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}