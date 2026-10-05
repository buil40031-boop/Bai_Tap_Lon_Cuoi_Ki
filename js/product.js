document.addEventListener("DOMContentLoaded", () => {
  const accountBtn = document.getElementById("account");

  accountBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    if (isLoggedIn === "true") {
      window.location.href = "account.html";
    } else {
      window.location.href = "login.html";
    }
  });
});

// Khai báo biến toàn cục để lưu danh sách sản phẩm lấy từ MariaDB
let globalProductsList = [];

// --- 1. HÀM LẤY DỮ LIỆU SẢN PHẨM TỪ MARIADB QUA BACKEND (Đã thay thế localStorage) ---
async function fetchProductsFromDB() {
  try {
    const response = await fetch('http://localhost:3000/api/products');
    const data = await response.json();
    globalProductsList = data; // Lưu dữ liệu vào biến toàn cục để dùng lại khi click mua hàng
    return data;
  } catch (error) {
    console.error('❌ Lỗi không lấy được sản phẩm từ MariaDB:', error);
    return [];
  }
}

function formatCurrency(amount) {
  return amount ? amount.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
}

// --- 2. RENDER TỰ ĐỘNG CÁC PRODUCT CARD ---
function renderProducts(productList) {
  const container = document.querySelector('.container');
  if (!container) return;

  container.innerHTML = '';
  
  if (productList.length === 0) {
    container.innerHTML = '<p style="text-align:center; width:100%;">Database chưa được kết nối!</p>';
    return;
  }

  productList.forEach(product => {
    const productDesc = product.description || "Sản phẩm Yến Sào cao cấp thiên nhiên";
    // Lấy đúng tên cột `img` trong bảng products MariaDB của cậu
    const imageSrc = product.img || product.image || '/images/default.jpg'; 

    const cardHTML = `
    <div class="product_card" data-id="${product.id}">
      <div class="card-img">
        <img src="${imageSrc}" alt="${product.name}">
      </div>
      <div class="card_content">
        <h3>${product.name}</h3>
        <p class="product_desc">${productDesc}</p>
        
        <div class="card_price_row">
          <span class="price">${formatCurrency(product.price)}</span>
          <a href="product_detail.html?id=${product.id}" class="product_properties">Chi tiết</a>
        </div>
      </div>
      <button class="buy_now">Thêm vào giỏ hàng</button>
     </div>`;
    container.innerHTML += cardHTML;
  });
}

// --- 3. CẬP NHẬT SỐ LƯỢNG SẢN PHẨM TRÊN ICON NAVBAR ---
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
  
  const cartCountBadge = document.getElementById('cart-count');
  if (!cartCountBadge) return;

  cartCountBadge.textContent = totalCount;

  if (totalCount > 0) {
    cartCountBadge.style.display = 'inline-flex';
  } else {
    cartCountBadge.style.display = 'none';
  }
}

// --- 4. HÀM HIỂN THỊ TOAST TỰ ẨN ---
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

// --- 5. THÊM SẢN PHẨM VÀO GIỎ HÀNG ---
function addToCart(product) {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");
  
  if (isLoggedIn !== "true") {
    alert("Vui lòng đăng nhập để thực hiện chức năng này!")
    window.location.href = "login.html";
    return;
  }

  let cart = JSON.parse(localStorage.getItem('CART')) || [];
  const existingItem = cart.find(item => String(item.id) === String(product.id));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name || "Tên sản phẩm",
      price: parseFloat(product.price) || 0,
      image: product.img || product.image || "",
      quantity: 1
    });
  }

  localStorage.setItem('CART', JSON.stringify(cart));
  updateCartCount();
  showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
}

// --- 6. SỰ KIỆN KHI TRANG TẢI XONG ---
document.addEventListener('DOMContentLoaded', async () => {
  // Lấy dữ liệu từ MariaDB về và render
  const productsFromDB = await fetchProductsFromDB();
  renderProducts(productsFromDB);
  updateCartCount();

  const container = document.querySelector('.container');
  if (container) {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('buy_now')) {
        const card = e.target.closest('.product_card');
        if (!card) return;

        const productId = card.dataset.id;
        // Lấy sản phẩm tương ứng từ danh sách vừa tải về từ MariaDB
        const targetProduct = globalProductsList.find(item => String(item.id) === String(productId));
        
        if (targetProduct) {
          addToCart(targetProduct);
        }
      }
    });
  }
});

// --- 7. NÚT BACK TO TOP ---
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