document.addEventListener('DOMContentLoaded', () => {
    // 1. Chuyển đổi giữa các trang (Tabs)
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.page-section');
    const dateInput = document.getElementById('dashboard-date');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = button.getAttribute('data-target');

            // Ẩn tất cả section
            sections.forEach(sec => sec.classList.add('hidden'));

            // Hiện section được bấm
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
            }

            // Gọi resize cho biểu đồ nếu vào trang Dashboard
            if (targetId === 'page-dashboard') {
                setTimeout(() => {
                    if (analyticsChartInstance) analyticsChartInstance.resize();
                    if (pieChartInstance) pieChartInstance.resize();
                }, 50);
            }
        });
    });

    if (dateInput) {
        // Mặc định chọn ngày hôm nay (YYYY-MM-DD)
        dateInput.value = new Date().toISOString().split('T')[0];
        
        // Khi chọn ngày mới -> Tải lại Dashboard & Biểu đồ
        dateInput.addEventListener('change', () => {
            renderDashboardCards();
            renderAnalyticsChart();
        });
    }

    // Chạy tải dữ liệu từ DB lần đầu khi vào trang
    initAdminData();
});

// BASE URL API Backend
const API_URL = 'http://localhost:3000/api';

// Biến lưu trữ dữ liệu tải từ DB
let productsData = [];
let ordersData = [];
let usersData = [];

// Biến quản lý biểu đồ Chart.js
let analyticsChartInstance = null;
let pieChartInstance = null;
let currentImageBase64 = "https://placehold.co/50x50?text=Yen";

// Định dạng tiền VNĐ
const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

// TẢI TOÀN BỘ DỮ LIỆU TỪ BACKEND / DATABASE
async function initAdminData() {
    try {
        await Promise.all([
            fetchProducts(),
            fetchOrders(),
            fetchUsers()
        ]);

        renderDashboardCards();
        renderAnalyticsChart();
        renderTopProducts();
        renderUsersTable();
        renderOrdersTable();
        renderProductsTable();
    } catch (err) {
        console.error("Lỗi khi tải dữ liệu Admin:", err);
    }
}

async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        productsData = await res.json();
    } catch (err) {
        console.error("Lỗi lấy danh sách sản phẩm:", err);
        productsData = [];
    }
}

async function fetchOrders() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        ordersData = await res.json();
    } catch (err) {
        console.error("Lỗi lấy danh sách đơn hàng:", err);
        ordersData = [];
    }
}

async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/users`);
        usersData = await res.json();
    } catch (err) {
        console.error("Lỗi lấy danh sách người dùng:", err);
        usersData = [];
    }
}

// Hàm tính khoảng thời gian (Tuần này vs Tuần trước) dựa trên mốc ngày được chọn
getDashboardTimeRange = () => {
    const dateInput = document.getElementById('dashboard-date');
    const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();
    
    // Đặt về 00:00:00 của ngày chọn
    selectedDate.setHours(0, 0, 0, 0);

    // Xác định Chủ Nhật đầu tuần của ngày được chọn
    const dayOfWeek = selectedDate.getDay(); 
    const startOfCurrentWeek = new Date(selectedDate);
    startOfCurrentWeek.setDate(selectedDate.getDate() - dayOfWeek);

    // Cuối tuần này (Thứ 7 lúc 23:59:59)
    const endOfCurrentWeek = new Date(startOfCurrentWeek);
    endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6);
    endOfCurrentWeek.setHours(23, 59, 59, 999);

    // Đầu tuần trước
    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);

    // Cuối tuần trước
    const endOfPreviousWeek = new Date(startOfCurrentWeek);
    endOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 1);
    endOfPreviousWeek.setHours(23, 59, 59, 999);

    return { startOfCurrentWeek, endOfCurrentWeek, startOfPreviousWeek, endOfPreviousWeek };
};

// Hàm tính % Tăng trưởng chuẩn
const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

// 1. THỐNG KÊ (DASHBOARD CARDS DỰA THEO MỐC THỜI GIAN)
function renderDashboardCards() {
    const dashboard = document.getElementById('page-dashboard');
    if (!dashboard) return;

    const cards = dashboard.querySelectorAll('.grid > div');
    if (cards.length < 4) return;

    const { startOfCurrentWeek, endOfCurrentWeek, startOfPreviousWeek, endOfPreviousWeek } = getDashboardTimeRange();

    // A. LỌC KHÁCH HÀNG (USERS)
    let currentUsers = 0, prevUsers = 0;
    usersData.forEach(u => {
        const uDate = new Date(u.created_at || u.date || Date.now());
        if (uDate >= startOfCurrentWeek && uDate <= endOfCurrentWeek) currentUsers++;
        else if (uDate >= startOfPreviousWeek && uDate <= endOfPreviousWeek) prevUsers++;
    });
    const userGrowth = calculateGrowth(currentUsers, prevUsers);

    // B. LỌC ĐƠN HÀNG (ORDERS) & DOANH THU (REVENUE)
    let currentOrders = 0, prevOrders = 0;
    let currentRevenue = 0, prevRevenue = 0;

    ordersData.forEach(o => {
        const oDate = new Date(o.created_at || o.date);
        const amount = parseFloat(o.total_price || o.total) || 0;

        if (oDate >= startOfCurrentWeek && oDate <= endOfCurrentWeek) {
            currentOrders++;
            currentRevenue += amount;
        } else if (oDate >= startOfPreviousWeek && oDate <= endOfPreviousWeek) {
            prevOrders++;
            prevRevenue += amount;
        }
    });

    const orderGrowth = calculateGrowth(currentOrders, prevOrders);
    const revenueGrowth = calculateGrowth(currentRevenue, prevRevenue);

    // Helper render hiển thị badge phần trăm
    const renderGrowthBadge = (growth) => {
        const isUp = growth >= 0;
        const color = isUp ? 'text-emerald-600' : 'text-rose-600';
        const icon = isUp ? 'fa-arrow-up' : 'fa-arrow-down';
        return `<span class="${color} font-semibold text-xs"><i class="fa-solid ${icon}"></i> ${Math.abs(growth).toFixed(1)}% so với tuần trước</span>`;
    };

    // Card 1: Khách hàng mới tuần này
    cards[0].querySelector('div').innerHTML = `
        <p class="text-gray-500 text-xs uppercase font-bold">Khách hàng mới</p>
        <h3 class="text-2xl font-bold text-gray-800">${currentUsers}</h3>
        <p class="mt-1">${renderGrowthBadge(userGrowth)}</p>
    `;

    // Card 2: Đơn hàng tuần này
    cards[1].querySelector('div').innerHTML = `
        <p class="text-gray-500 text-xs uppercase font-bold">Đơn hàng (Tuần chọn)</p>
        <h3 class="text-2xl font-bold text-gray-800">${currentOrders}</h3>
        <p class="mt-1">${renderGrowthBadge(orderGrowth)}</p>
    `;

    // Card 3: Doanh thu tuần này
    cards[2].querySelector('div').innerHTML = `
        <p class="text-gray-500 text-xs uppercase font-bold">Doanh thu (Tuần chọn)</p>
        <h3 class="text-2xl font-bold text-gray-800">${formatMoney(currentRevenue)}</h3>
        <p class="mt-1">${renderGrowthBadge(revenueGrowth)}</p>
    `;

    // Card 4: Tăng trưởng doanh thu tổng hợp
    const growthColor = revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600';
    const growthIcon = revenueGrowth >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    cards[3].querySelector('div').innerHTML = `
        <p class="text-gray-500 text-xs uppercase font-bold">Mức độ tăng trưởng</p>
        <h3 class="text-2xl font-bold ${growthColor}">${revenueGrowth.toFixed(1)}%</h3>
        <p class="text-xs ${growthColor} font-semibold mt-1">
            <i class="fa-solid ${growthIcon}"></i> Tăng trưởng doanh thu
        </p>
    `;
}

// 2. BIỂU ĐỒ DOANH THU ĐỒNG BỘ THEO MỐC THỜI GIAN
function renderAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const currentWeekData = [0, 0, 0, 0, 0, 0, 0];
    const previousWeekData = [0, 0, 0, 0, 0, 0, 0];

    const { startOfCurrentWeek, endOfCurrentWeek, startOfPreviousWeek, endOfPreviousWeek } = getDashboardTimeRange();

    ordersData.forEach(order => {
        const orderDate = new Date(order.created_at || order.date);
        const amount = parseFloat(order.total_price || order.total) || 0;

        if (orderDate >= startOfCurrentWeek && orderDate <= endOfCurrentWeek) {
            const dayIndex = orderDate.getDay();
            currentWeekData[dayIndex] += amount;
        } else if (orderDate >= startOfPreviousWeek && orderDate <= endOfPreviousWeek) {
            const dayIndex = orderDate.getDay();
            previousWeekData[dayIndex] += amount;
        }
    });

    if (analyticsChartInstance) {
        analyticsChartInstance.destroy();
    }

    analyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Tuần này',
                    data: currentWeekData,
                    borderColor: '#f57c00',
                    backgroundColor: 'rgba(245, 124, 0, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Tuần tuần trước',
                    data: previousWeekData,
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.05)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => value.toLocaleString('vi-VN') + 'đ'
                    }
                }
            }
        }
    });
}

// 3. SẢN PHẨM BÁN NHIỀU NHẤT (sold >= 30) & PIE CHART
function renderTopProducts() {
    const topSection = document.getElementById('page-top-product');
    if (!topSection) return;

    const tbody = topSection.querySelector('tbody');
    
    // Lọc sản phẩm có số lượng đã bán >= 30
    const topProducts = productsData.filter(p => (parseInt(p.sold) || 0) >= 30);

    if (tbody) {
        if (topProducts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Chưa có sản phẩm nào đạt mốc bán chạy (>= 30)</td></tr>`;
        } else {
            tbody.innerHTML = topProducts.map(p => {
                const sold = parseInt(p.sold) || 0;
                const price = parseFloat(p.price) || 0;
                const profit = sold * price;

                return `
                    <tr class="hover:bg-gray-50">
                        <td class="p-4 font-medium text-gray-800">${p.name}</td>
                        <td class="p-4">${formatMoney(price)}</td>
                        <td class="p-4 font-bold text-amber-700">${sold}</td>
                        <td class="p-4 text-emerald-600 font-semibold">${formatMoney(profit)}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Vẽ Biểu Đồ Tròn (Pie/Doughnut Chart)
    const pieCtx = document.getElementById('pieChart');
    if (!pieCtx) return;

    const labels = topProducts.map(p => p.name);
    const data = topProducts.map(p => parseInt(p.sold) || 0);

    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ["Chưa có dữ liệu"],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#6366f1'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '60%'
        }
    });
}

// 4. DANH SÁCH NGƯỜI DÙNG (USERS)
function renderUsersTable() {
    const userSection = document.getElementById('page-user');
    if (!userSection) return;

    const tbody = userSection.querySelector('tbody');
    if (!tbody) return;

    if (usersData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">Chưa có người dùng nào</td></tr>`;
        return;
    }

    tbody.innerHTML = usersData.map(u => {
        // Lọc tất cả đơn hàng của user này để tính toán
        const userOrders = ordersData.filter(o => o.user_id === u.id);
        
        let totalItemsBought = 0;
        let totalSpent = 0;

        userOrders.forEach(o => {
            totalSpent += parseFloat(o.total_price) || 0;
            if (o.items && Array.isArray(o.items)) {
                totalItemsBought += o.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
            }
        });

        return `
            <tr class="hover:bg-gray-50">
                <td class="p-4 font-semibold text-gray-800">
                    <div>${u.fullname || u.username || 'Khách hàng'}</div>
                </td>
                <td class="p-4 font-medium">${totalItemsBought} sản phẩm</td>
                <td class="p-4 text-emerald-600 font-bold">${formatMoney(totalSpent)}</td>
            </tr>
        `;
    }).join('');
}

// 5. QUẢN LÝ ĐƠN HÀNG (ORDERS)
function renderOrdersTable() {
    const ordersSection = document.getElementById('page-orders') || document.getElementById('page_orders');
    if (!ordersSection) return;

    const tbody = ordersSection.querySelector('tbody');
    if (!tbody) return;

    if (!ordersData || ordersData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">Chưa có đơn hàng nào</td></tr>`;
        return;
    }

    tbody.innerHTML = ordersData.map(o => {
        // Render danh sách sản phẩm
        const itemsList = o.items && Array.isArray(o.items) && o.items.length > 0
            ? o.items.map(i => `• ${i.product_name || 'Sản phẩm'} <span class="text-gray-500">(x${i.quantity})</span>`).join('<br>')
            : 'Không có chi tiết';

        // Badge Trạng thái
        let statusBadge = '';
        switch (o.status) {
            case 'Chờ xử lý':
                statusBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">Chờ xử lý</span>`;
                break;
            case 'Đã giao':
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">Đã giao</span>`;
                break;
            case 'Đã hủy':
                statusBadge = `<span class="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">Đã hủy</span>`;
                break;
            default:
                statusBadge = `<span class="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">${o.status || 'Chờ xử lý'}</span>`;
        }

        return `
            <tr class="hover:bg-gray-50 align-top">
                <td class="p-4 font-bold text-amber-800 whitespace-nowrap">#${o.order_code || o.id}</td>
                <td class="p-4 font-medium text-gray-800">${o.customer_name || o.fullname || `User #${o.user_id}`}</td>
                <td class="p-4 text-gray-600 whitespace-nowrap">${o.phone || '---'}</td>
                <td class="p-4 text-xs text-gray-600 leading-relaxed break-words whitespace-normal max-w-[250px]">
                    ${o.address || 'Chưa cập nhật địa chỉ'}
                </td>
                <td class="p-4 text-xs text-gray-700 leading-relaxed whitespace-normal min-w-[200px]">
                    ${itemsList}
                </td>
                <td class="p-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                    ${formatMoney(o.total_price)}
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    ${statusBadge}
                </td>
            </tr>
        `;
    }).join('');
}

// 6. TRANG SẢN PHẨM & BỘ LỌC OPTION
function renderProductsTable() {
    const productSection = document.getElementById('page-product');
    if (!productSection) return;

    const tbody = document.getElementById('rendered-product');
    if (!tbody) return;

    // Tự động khởi tạo bộ lọc 1 lần duy nhất nếu chưa khởi tạo
    initCategoryFilterOnce();

    // Lấy giá trị đang chọn từ bộ lọc
    const filterSelect = document.getElementById('category-filter');
    const selectedCategory = filterSelect ? filterSelect.value : 'all';

    let filtered = productsData;

    // Lọc sản phẩm (dùng trim() và toLowerCase() để so sánh linh hoạt)
    if (selectedCategory !== 'all') {
        filtered = productsData.filter(p => {
            if (!p.category) return false;
            return p.category.trim().toLowerCase().includes(selectedCategory.trim().toLowerCase()) ||
                   selectedCategory.trim().toLowerCase().includes(p.category.trim().toLowerCase());
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">Không tìm thấy sản phẩm nào</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-4">
                <img src="${p.img}" class="w-12 h-12 object-cover rounded-lg border">
            </td>
            <td class="p-4 font-semibold text-gray-800">${p.name}</td>
            <td class="p-4"><span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">${p.category || 'Chưa phân loại'}</span></td>
            <td class="p-4 font-medium text-amber-900">${formatMoney(p.price)}</td>
            <td class="p-4">${p.stock}</td>
            <td class="p-4 font-bold text-emerald-600">${p.sold || 0}</td>
            <td class="p-4">
                <button onclick="deleteProduct(${p.id})" class="text-rose-600 hover:text-rose-800 font-medium text-xs flex items-center gap-1">
                    <i class="fa-solid fa-trash"></i> Xóa
                </button>
            </td>
        </tr>
    `).join('');
}

// Hàm khởi tạo thẻ Select bộ lọc 1 lần duy nhất
function initCategoryFilterOnce() {
    // Nếu thẻ select đã tồn tại thì không tạo lại nữa
    if (document.getElementById('category-filter')) return;

    const productSection = document.getElementById('page-product');
    if (!productSection) return;
}

function filterProducts(category) {
    renderProductsTable();
}

// 7. THÊM SẢN PHẨM MỚI (GỬI LÊN BACKEND)
document.getElementById('p-image')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const previewImg = document.getElementById('image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentImageBase64 = event.target.result;
            previewImg.src = currentImageBase64;
            previewImg.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('add-product-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('p-image');
    
    // Dùng FormData để gửi vừa Text vừa File
    const formData = new FormData();
    formData.append('name', document.getElementById('p-name').value.trim());
    formData.append('category', document.getElementById('p-category').value);
    formData.append('price', parseFloat(document.getElementById('p-price').value));
    formData.append('stock', parseInt(document.getElementById('p-stock').value) || 0);
    formData.append('usage', document.getElementById('p-usage')?.value || '');
    formData.append('storage', document.getElementById('p-storage')?.value || '');
    formData.append('warning', document.getElementById('p-warning')?.value || '');
    formData.append('description', document.getElementById('p-description')?.value || '');

    // Đưa file ảnh thật vào FormData
    if (fileInput && fileInput.files[0]) {
        formData.append('imageFile', fileInput.files[0]);
    }

    try {
        const res = await fetch(`${API_URL}/products`, {
            method: 'POST',
            // Lưu ý: KHÔNG thêm 'Content-Type': 'application/json' khi dùng FormData
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            alert("Thêm sản phẩm mới thành công!");
            this.reset();
            document.getElementById('image-preview')?.classList.add('hidden');
            initAdminData();
        } else {
            alert("Lỗi từ server: " + (data.error || "Không thể thêm sản phẩm!"));
        }
    } catch (err) {
        console.error("Lỗi gửi dữ liệu:", err);
        alert("Không thể kết nối đến Server!");
    }
});

// Xóa sản phẩm qua API
async function deleteProduct(id) {
    if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi CSDL?")) {
        try {
            const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                initAdminData();
            } else {
                alert("Xóa thất bại!");
            }
        } catch (err) {
            console.error("Lỗi xóa sản phẩm:", err);
        }
    }
}

// Xử lý đăng xuất
document.addEventListener("click", (e) => {
    const logoutBtn = e.target.closest("#logout");
    if (logoutBtn) {
        e.preventDefault();
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            sessionStorage.clear();
            window.location.href = "../index.html";
        }
    }
});