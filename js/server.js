const express = require('express');
const mysql = require('mysql2/promise'); // Sử dụng mysql2/promise hỗ trợ async/await & Transaction
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();

// Middleware giải mã dữ liệu (Hỗ trợ Base64 dung lượng lớn cho ảnh sản phẩm)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// A. Cấu hình kết nối tới MariaDB/MySQL (Dùng Pool + Promise)
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'project',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối
db.getConnection()
  .then(conn => {
    console.log('Đã kết nối thành công tới Database!');
    conn.release();
  })
  .catch(err => {
    console.error('Không thể kết nối với database:', err.message);
  });

// B. CÁC API DÀNH CHO ADMIN (BỔ SUNG MỚI)

// 1. Lấy danh sách toàn bộ người dùng cho trang Admin User
app.get('/api/users', async (req, res) => {
  try {
    const [results] = await db.query('SELECT *, name AS fullname, email FROM users');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Lấy danh sách toàn bộ đơn hàng kèm sản phẩm (Dùng cho Admin Dashboard & Orders)
app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await db.query('SELECT *, total_price AS total FROM orders ORDER BY created_at DESC');

    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);

    // Dùng [orderIds] trong mysql2 để tạo tham số IN (1, 2, 3) hợp lệ
    const [items] = await db.query(`
      SELECT oi.*, p.name AS product_name 
      FROM orders_item oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (?)
    `, [orderIds]);

    // Ghép items vào từng order tương ứng
    const result = orders.map(order => ({
      ...order,
      items: items.filter(item => item.order_id === order.id)
    }));

    res.json(result);
  } catch (err) {
    console.error("Lỗi lấy danh sách đơn hàng:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Thêm sản phẩm mới (Cho trang Admin Thêm Sản Phẩm)
// Cấu hình thư mục chứa ảnh tĩnh để trình duyệt xem được ảnh từ URL
app.use('/product_images', express.static(path.join(__dirname, 'product_images')));

// Cấu hình nơi lưu và tên file khi Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'product_images')); // lưu vào thư mục tuỳ chỉnh
  },
  filename: (req, file, cb) => {
    // Đổi tên file để tránh trùng lặp: timestamp - tên_gốc
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// API Thêm sản phẩm có upload file ảnh
app.post('/api/products', upload.single('imageFile'), async (req, res) => {
  try {
    const { name, category, price, stock, usage, storage: pStorage, warning, description } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Tên sản phẩm và Giá bán không được để trống!' });
    }

    // Nếu người dùng có upload ảnh -> Lấy đường dẫn tương đối, nếu không thì để chuỗi rỗng
    const imagePath = req.file ? `./product_images/${req.file.filename}` : '';

    const sql = `
      INSERT INTO products (name, category, price, stock, \`usage\`, storage, warning, description, img, sold) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const [result] = await db.query(sql, [
      name, 
      category || 'Chưa phân loại', 
      price, 
      stock || 0, 
      usage || '', 
      pStorage || '', 
      warning || '', 
      description || '', 
      imagePath
    ]);

    res.status(201).json({ 
      message: 'Thêm sản phẩm thành công!', 
      id: result.insertId,
      img: imagePath 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Xóa sản phẩm theo ID (Cho trang Admin Danh sách SP)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Xóa các liên kết options liên quan trước (nếu có)
    await db.query('DELETE FROM options WHERE product_id = ?', [productId]);
    
    // Xóa sản phẩm
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm để xóa!' });
    }

    res.json({ message: 'Xóa sản phẩm thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// C. CÁC API DÀNH CHO SẢN PHẨM & BIẾN THỂ
app.get('/api/products', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM products');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id/options', async (req, res) => {
  try {
    const productId = req.params.id;
    const [results] = await db.query('SELECT * FROM options WHERE product_id = ?', [productId]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// D. CÁC API DÀNH CHO YÊU THÍCH (FAVORITES)
app.get('/api/favorites', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.json([]);

    const [results] = await db.query('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
    res.json(results.map(row => row.product_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/favorites/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [results] = await db.query('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
    res.json(results.map(row => row.product_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/favorites/toggle', async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ error: 'Thiếu userId hoặc productId' });
    }

    const [results] = await db.query('SELECT * FROM favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);

    if (results.length > 0) {
      await db.query('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);
      res.json({ action: 'removed', message: 'Đã bỏ yêu thích sản phẩm' });
    } else {
      await db.query('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [userId, productId]);
      res.json({ action: 'added', message: 'Đã thêm vào danh sách yêu thích' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// E. CÁC API DÀNH CHO XÁC THỰC & USER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin!' });
    }

    const [results] = await db.query('SELECT * FROM users WHERE name = ? OR email = ?', [name, email]);

    if (results.length > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc Email đã được sử dụng!' });
    }

    await db.query('INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)', [name, email, password, phone]);
    res.json({ message: 'Đăng ký tài khoản thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu!' });
    }

    const [results] = await db.query('SELECT id, name, email, phone, address FROM users WHERE email = ? AND password = ?', [email, password]);

    if (results.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = results[0];
    res.json({
      message: 'Đăng nhập thành công!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const [results] = await db.query('SELECT id, name AS fullname, email, phone, address, ward, city, country FROM users WHERE id = ?', [userId]);
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id/address', async (req, res) => {
  try {
    const userId = req.params.id;
    const [results] = await db.query('SELECT id, name AS fullname, phone, address AS detail, ward, city, country FROM users WHERE id = ?', [userId]);
    if (results.length === 0) return res.status(404).json({ message: 'Không có dữ liệu địa chỉ' });
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/address', async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullname, phone, detail, ward, city, country } = req.body;

    const sql = `
      UPDATE users 
      SET name = ?, phone = ?, address = ?, ward = ?, city = ?, country = ? 
      WHERE id = ?
    `;

    await db.query(sql, [fullname, phone, detail, ward || '', city || '', country || 'Việt Nam', userId]);
    res.json({ message: 'Cập nhật địa chỉ thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/profile', async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullname, currentPassword, newPassword } = req.body;

    const [results] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (results.length === 0) return res.status(404).json({ message: 'Tài khoản không tồn tại' });

    const userInDb = results[0];

    if (newPassword) {
      if (!currentPassword || userInDb.password !== currentPassword) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác!' });
      }
    }

    const updatedPass = newPassword ? newPassword : userInDb.password;
    await db.query('UPDATE users SET name = ?, password = ? WHERE id = ?', [fullname, updatedPass, userId]);
    res.json({ message: 'Đã cập nhật thông tin thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// F. CÁC API ĐẶT HÀNG & HỦY ĐƠN
app.post('/api/orders', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection(); 
    await connection.beginTransaction();   
    const {
      order_code,
      user_id,
      customer_name,
      email,
      phone,
      address,
      total_price,
      payment_method,
      items
    } = req.body;

    // 1. Thêm đơn hàng vào bảng orders
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_code, user_id, customer_name, email, phone, address, total_price, payment_method, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Chờ xử lý')`,
      [order_code, user_id, customer_name, email, phone, address, total_price, payment_method]
    );

    const orderId = orderResult.insertId;

    // 2. Lặp qua từng sản phẩm trong đơn hàng
    for (const item of items) {
      const productId = item.product_id;
      const optionId = item.option_id;
      const quantity = parseInt(item.quantity) || 1;

      // 2.1. Thêm chi tiết vào bảng orders_item
      await connection.query(
        `INSERT INTO orders_item (order_id, product_id, option_id, price, quantity) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, productId, optionId, item.price, quantity]
      );

      // 2.2. Trừ stock & tăng sold ở bảng options (nếu chọn option)
      if (optionId) {
        await connection.query(
          `UPDATE options 
           SET stock = GREATEST(0, stock - ?), 
               sold = COALESCE(sold, 0) + ? 
           WHERE id = ?`,
          [quantity, quantity, optionId]
        );
      }

      // 2.3. Cập nhật tổng stock & sold ở bảng products
      await connection.query(
        `UPDATE products 
         SET stock = GREATEST(0, stock - ?), 
             sold = COALESCE(sold, 0) + ? 
         WHERE id = ?`,
        [quantity, quantity, productId]
      );
    }

    await connection.commit();
    res.status(201).json({ message: "Đặt hàng thành công!", order_id: orderId });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Lỗi khi lưu đơn hàng:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi tạo đơn hàng!" });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [orders] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);

    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);

    const [items] = await db.query(`
      SELECT oi.*, p.name AS product_name 
      FROM orders_item oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (?)
    `, [orderIds]);

    const result = orders.map(order => ({
      ...order,
      items: items.filter(item => item.order_id === order.id)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:orderCode/cancel', async (req, res) => {
  try {
    const orderCode = req.params.orderCode;
    await db.query('UPDATE orders SET status = "Đã hủy" WHERE order_code = ? OR id = ?', [orderCode, orderCode]);
    res.json({ message: 'Đã hủy đơn hàng thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// G. Bật Server chạy ở cổng 3000
app.listen(3000, () => {
  console.log('Server đang chạy tại http://localhost:3000');
});