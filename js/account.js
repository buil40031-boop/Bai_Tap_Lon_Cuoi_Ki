// 1. CẤU HÌNH API & KIỂM TRA ĐĂNG NHẬP
const API_BASE_URL = 'http://localhost:3000/api';

// Lấy thông tin user linh hoạt từ localStorage
const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {};
const userId = sessionStorage.getItem('userId') || currentUser.id;
const token = sessionStorage.getItem('token') || '';
const isLoggedIn = sessionStorage.getItem('isLoggedIn');

// Kiểm tra nếu chưa đăng nhập hoặc không tìm thấy ID người dùng
if (!userId || (isLoggedIn !== 'true' && !token)) {
  alert('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!');
  window.location.href = '../html/login.html';
}

// 2. QUẢN LÝ HIỂN THỊ TRANG CON
const pages = {
  head: document.getElementById('head_account_page'),
  cart: document.getElementById('cart_page'),
  address: document.getElementById('address_page'),
  addressSubmit: document.getElementById('address_submit_page'),
  account: document.getElementById('change_p_account_page'),
};

function showPage(targetPage) {
  Object.values(pages).forEach(page => {
    if (page) page.classList.add('hidden');
  });
  if (targetPage) targetPage.classList.remove('hidden');

  if (targetPage === pages.cart) renderUserOrders();
  if (targetPage === pages.address) renderUserAddress();
}

// 3. LẤY THÔNG TIN USER TỪ DATABASE
async function fetchUserProfile() {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error('Không thể tải thông tin tài khoản');

    currentUserData = await res.json();
    updateDisplayNameUI();
    fillAccountForm();
  } catch (err) {
    console.error('Lỗi fetchUserProfile:', err);
    alert('Database chưa được kết nối!');
  }
}

function updateDisplayNameUI() {
  const noticeText = document.querySelector('#notice_head_account_page p');
  const displayName = currentUserData?.fullname || currentUserData?.name || currentUserData?.email || 'Khách hàng';

  if (noticeText) {
    noticeText.innerHTML = `Xin chào <strong>${displayName}</strong> (không phải <strong>${displayName}</strong>? <a href="#" class="btn_to_logout">Đăng xuất</a>)`;
  }
}

function fillAccountForm() {
  const accNameInput = document.getElementById('acc_name');
  const accEmailInput = document.getElementById('acc_email');
  if (accNameInput) accNameInput.value = currentUserData?.fullname || currentUserData?.name || '';
  if (accEmailInput) accEmailInput.value = currentUserData?.email || '';
}

// 4. ĐỊA CHỈ: HIỂN THỊ & CẬP NHẬT TRÊN DATABASE
async function renderUserAddress() {
  const noAddressBox = document.getElementById('no_address_info');
  const hasAddressBox = document.getElementById('has_address_info');
  const addressDetails = document.getElementById('address_card_details');

  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/address`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const addrData = await res.json();

      // Kiểm tra nếu có dữ liệu địa chỉ trong DB
      if (addrData && (addrData.address || addrData.detail)) {
        if (noAddressBox) noAddressBox.classList.add('hidden');
        if (hasAddressBox) hasAddressBox.classList.remove('hidden');

        const fullAddress = [
          addrData.detail || addrData.address,
          addrData.ward,
          addrData.city,
          addrData.country || 'Việt Nam'
        ].filter(Boolean).join(', ');

        if (addressDetails) {
          addressDetails.innerHTML = `
            <p><strong>Họ và tên:</strong> ${addrData.fullname || currentUserData?.fullname || 'Khách hàng'}</p>
            <p><strong>Số điện thoại:</strong> ${addrData.phone || 'Chưa cập nhật'}</p>
            <p><strong>Địa chỉ:</strong> ${fullAddress}</p>
            <a href="#" id="to_address_submit" class="btn_edit_address">Chỉnh sửa địa chỉ</a>
          `;
        }
        return;
      }
    }
  } catch (err) {
    console.error('Lỗi khi lấy địa chỉ từ DB:', err);
  }

  // Nếu chưa có địa chỉ trong DB
  if (noAddressBox) noAddressBox.classList.remove('hidden');
  if (hasAddressBox) hasAddressBox.classList.add('hidden');
}

// Lưu địa chỉ mới vào Database
document.getElementById('save_address')?.addEventListener('click', async () => {
  const fullname = document.getElementById('addr_fullname').value.trim();
  const country = document.getElementById('addr_country').value.trim();
  const city = document.getElementById('addr_city').value.trim();
  const ward = document.getElementById('addr_ward').value.trim();
  const detail = document.getElementById('addr_detail').value.trim();
  const phone = document.getElementById('addr_phone').value.trim();

  if (!fullname || !phone || !detail) {
    alert('Vui lòng điền đầy đủ thông tin địa chỉ!');
    return;
  }

  const payload = { fullname, country, city, ward, detail, phone };

  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/address`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Đã cập nhật địa chỉ!');
      showPage(pages.address);
    } else {
      const errData = await res.json();
      alert('Lỗi: ' + (errData.message || 'Không thể lưu địa chỉ'));
    }
  } catch (err) {
    console.error('Lỗi gửi địa chỉ lên DB:', err);
    alert('Lỗi kết nối Server!');
  }
});

updateCartCount();

// 5. ĐƠN HÀNG: LẤY & HỦY ĐƠN TỪ DATABASE
async function renderUserOrders() {
  const ordersListContainer = document.getElementById('orders_list');
  const emptyOrdersBox = document.getElementById('empty_orders_box');
  const ordersPageSection = document.getElementById('orders_page');

  if (!ordersListContainer) return;

  try {
    const res = await fetch(`${API_BASE_URL}/orders/user/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Lỗi truy vấn đơn hàng');

    const myOrders = await res.json();

    if (!myOrders || myOrders.length === 0) {
      if (emptyOrdersBox) emptyOrdersBox.classList.remove('hidden');
      if (ordersPageSection) ordersPageSection.classList.add('hidden');
      return;
    }

    if (emptyOrdersBox) emptyOrdersBox.classList.add('hidden');
    if (ordersPageSection) ordersPageSection.classList.remove('hidden');

    ordersListContainer.innerHTML = myOrders.map(order => {
      const orderCode = order.order_code || order.id;
      const orderStatus = order.status || "Chờ xử lý";
      const totalPrice = parseFloat(order.total_price || 0);
      const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString("vi-VN") : "N/A";
      const items = order.items || [];
      const canCancel = orderStatus === "Chờ xử lý";

      return `
        <div class="order-card" style="border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 15px; border-radius: 8px; background: #fff;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
            <span>Mã đơn: #${orderCode}</span>
            <span class="order-status" style="color: ${getStatusColor(orderStatus)};">${orderStatus}</span>
          </div>
          <p style="font-size: 13px; color: #888; margin: 5px 0;">Ngày đặt: ${orderDate}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
          <div class="order-items">
            ${items.map(item => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.name || item.product_name} (x${item.quantity})</span>
                <strong>${(parseFloat(item.price) * parseInt(item.quantity)).toLocaleString('vi-VN')}đ</strong>
              </div>
            `).join('')}
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              ${canCancel ? `<button class="btn-cancel-order" data-id="${orderCode}" style="background: #ff4d4f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Hủy đơn hàng</button>` : ''}
            </div>
            <p style="font-size: 16px; margin: 0;">
              Tổng tiền: <strong style="color: #e74c3c;">${totalPrice.toLocaleString('vi-VN')}đ</strong>
            </p>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error("Lỗi lấy đơn hàng từ DB:", err);
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'Chờ xử lý': return '#f39c12';
    case 'Đang giao': return '#3498db';
    case 'Đã giao': return '#2ecc71';
    case 'Đã hủy': return '#e74c3c';
    default: return '#333';
  }
}

// 6. CẬP NHẬT TÀI KHOẢN & MẬT KHẨU
document.getElementById('save_change_account')?.addEventListener('click', async () => {
  const newName = document.getElementById('acc_name').value.trim();
  const currPass = document.getElementById('curr_pass').value;
  const newPass = document.getElementById('new_pass').value;
  const confirmNewPass = document.getElementById('confirm_new_pass').value;

  if (newPass || confirmNewPass) {
    if (!currPass) {
      alert('Vui lòng nhập mật khẩu hiện tại để thực hiện đổi mật khẩu!');
      return;
    }
    if (newPass !== confirmNewPass) {
      alert('Mật khẩu mới không trùng khớp!');
      return;
    }
  }

  const payload = {
    fullname: newName,
    currentPassword: currPass || null,
    newPassword: newPass || null
  };

  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert('Cập nhật thông tin thành công!');
      document.getElementById('curr_pass').value = '';
      document.getElementById('new_pass').value = '';
      document.getElementById('confirm_new_pass').value = '';

      // Tải lại dữ liệu mới nhất từ DB
      await fetchUserProfile();
      showPage(pages.head);
    } else {
      alert('Lỗi: ' + (data.message || 'Cập nhật thất bại'));
    }
  } catch (err) {
    console.error('Lỗi khi cập nhật tài khoản:', err);
    alert('Máy chủ chưa được kết nối!');
  }
});

// 7. EVENT LISTENERS & CHUYỂN TRANG
document.addEventListener('DOMContentLoaded', async () => {
  await fetchUserProfile();
  renderUserAddress();
  renderUserOrders();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('page') === 'cart') {
    showPage(pages.cart);
  }
});

document.addEventListener('click', async function (e) {
  const target = e.target;

  if (target.matches('#to_head_account_page, .btn_to_head')) {
    e.preventDefault();
    showPage(pages.head);
  }

  if (target.matches('#to_cart_page, .btn_to_cart')) {
    e.preventDefault();
    showPage(pages.cart);
  }

  if (target.matches('#to_address_page, .btn_to_address')) {
    e.preventDefault();
    showPage(pages.address);
  }

  if (target.matches('#to_address_submit')) {
    e.preventDefault();
    // Fill địa chỉ hiện tại từ DB vào Form sửa
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/address`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const addr = await res.json();
        document.getElementById('addr_fullname').value = addr.fullname || currentUserData?.fullname || '';
        document.getElementById('addr_country').value = addr.country || 'Việt Nam';
        document.getElementById('addr_city').value = addr.city || '';
        document.getElementById('addr_ward').value = addr.ward || '';
        document.getElementById('addr_detail').value = addr.detail || addr.address || '';
        document.getElementById('addr_phone').value = addr.phone || '';
      }
    } catch (err) {
      console.error('Lỗi load form địa chỉ:', err);
    }
    showPage(pages.addressSubmit);
  }

  if (target.matches('#to_account_page, .btn_to_account')) {
    e.preventDefault();
    showPage(pages.account);
  }

  if (target.matches('#to_logout_page, .btn_to_logout')) {
    e.preventDefault();
    if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
      sessionStorage.clear(); // Xóa sạch token & session
      window.location.href = '../html/login.html';
    }
  }

  // Hủy đơn hàng trên Server
  if (target.classList.contains('btn-cancel-order')) {
    const orderCode = target.getAttribute('data-id');

    if (confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderCode} không?`)) {
      try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderCode}/cancel`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          alert(`Đã hủy đơn hàng #${orderCode} thành công!`);
          renderUserOrders(); // Render lại danh sách từ DB
        } else {
          const errData = await res.json();
          alert('Không thể hủy đơn: ' + (errData.message || 'Lỗi hệ thống'));
        }
      } catch (err) {
        console.error("Lỗi khi gửi yêu cầu hủy đơn:", err);
      }
    }
  }
});

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('CART')) || JSON.parse(localStorage.getItem('cart')) || [];
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);

  const cartCountBadge = document.getElementById('cart-count');
  if (!cartCountBadge) return;

  cartCountBadge.textContent = totalCount;
  cartCountBadge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
}