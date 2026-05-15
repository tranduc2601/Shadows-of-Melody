# Shadows of Melody - Features & Future Roadmap

## 1) Các tính năng đã hoàn thành

### Giao diện & trải nghiệm người dùng
- Giao diện homepage hiện đại theo phong cách music streaming với tông màu tối, hiệu ứng gradient và blur.
- Layout chính gồm `Sidebar`, `MainLayout` và `PlayerBar` giúp điều hướng và phát nhạc xuyên suốt.
- Header có:
  - nút quay lại / tiến tới,
  - ô tìm kiếm nhanh,
  - trạng thái đăng nhập / avatar người dùng,
  - menu dropdown cho tài khoản.
- Thiết kế responsive cho desktop và mobile.

### Khám phá nội dung
- Hero section nổi bật bài hát/trending song hàng đầu.
- Danh sách `Trending Now` hiển thị bảng bài hát theo lượt nghe.
- Khu vực `Top Artists` hiển thị nghệ sĩ nổi bật.
- Khu vực `New Releases` hiển thị album mới theo dạng carousel ngang.
- Khu vực `Artist Members` hiển thị thành viên/nghệ sĩ liên quan.
- `Recently Played` chỉ hiện khi user đã đăng nhập và có lịch sử nghe.

### Phát nhạc
- Phát bài trực tiếp từ hero, trending list, recently played, album card và album overlay.
- Phát album theo danh sách bài hát có sẵn.
- Shuffle album trước khi phát.
- Click một bài hát có thể phát cả queue bài liên quan.
- `PlayerBar` dùng làm trình phát cố định ở dưới màn hình.

### Tương tác bài hát
- Like / unlike bài hát.
- Thêm bài hát vào playlist.
- Đồng bộ trạng thái favorite giữa các component bằng custom event.
- Hiển thị số lượt nghe và thời lượng bài hát.

### Album overlay
- Mở overlay chi tiết album khi click vào album card.
- Hiển thị ảnh bìa, thông tin album, danh sách bài hát trong album.
- Có nút `Play All` và `Shuffle` ngay trong overlay.

### Xác thực & tài khoản
- Phân biệt user đã đăng nhập / chưa đăng nhập.
- Hiển thị greeting theo thời gian trong ngày.
- Hiển thị avatar hoặc initials nếu không có ảnh.
- Logout từ dropdown avatar.
- Điều hướng đến login khi cần tương tác tính năng yêu cầu đăng nhập.

### Điều hướng & tìm kiếm
- Tìm kiếm nhanh từ header, điều hướng sang trang search với query.
- Điều hướng tới artist detail, album overlay và các trang chức năng khác.

---

## 2) Các hướng phát triển tương lai

### Nhóm A - Cá nhân hóa
- Gợi ý nhạc theo hành vi nghe và lượt thích.
- “For You” / “Daily Mix” theo từng user.
- Tự động lưu trạng thái nghe gần nhất và resume playback.
- Giao diện lịch sử nghe chi tiết hơn.

### Nhóm B - Playlist & thư viện
- CRUD playlist đầy đủ: tạo, đổi tên, xóa, sắp xếp, kéo thả bài hát.
- Trang thư viện cá nhân: liked songs, albums đã lưu, artists theo dõi.
- Chia sẻ playlist qua link công khai.
- Import/export playlist.

### Nhóm C - Tìm kiếm & khám phá
- Search nâng cao theo bài hát, nghệ sĩ, album, thể loại.
- Bộ lọc và sắp xếp kết quả search.
- Trang genre / mood / chart riêng.
- Mở rộng trang artist với discography, followers, related artists.

### Nhóm D - Player
- Queue panel đầy đủ: reorder, skip, repeat, autoplay.
- Lyrics đồng bộ thời gian.
- Mini player / full player mode.
- Preload bài hát tiếp theo để chuyển mượt hơn.
- Crossfade / gapless playback nếu backend hỗ trợ.

### Nhóm E - Admin & vận hành
- Dashboard quản trị upload/bài hát/nghệ sĩ/album.
- Kiểm duyệt nội dung upload.
- Thống kê lượt nghe, top songs, top artists theo thời gian.
- Quản lý user, role, subscription, report.

### Nhóm F - Subscription & kiếm tiền
- Trang subscription rõ ràng hơn.
- Gói premium với tính năng độc quyền.
- Thanh toán và quản lý hóa đơn.
- Phân quyền nội dung theo gói.

### Nhóm G - Chất lượng sản phẩm
- Accessibility: keyboard navigation, aria labels, focus states.
- Tối ưu hiệu năng render danh sách lớn.
- Skeleton loading / empty states đồng bộ.
- Test tự động cho API, UI logic và player flow.
- Chuẩn hóa component design system.

---

## 3) Phân task chi tiết cho 3 dev

> Mục tiêu của phần này là chia đều khối lượng giữa frontend và backend cho cả 3 người, đồng thời đảm bảo mỗi người có cả task dễ lẫn task khó để cân bằng năng lực và tiến độ.

### A. Trần Hoàng Duy
**Vai trò chính:** Frontend UI/UX, điều hướng, trải nghiệm khám phá nội dung.

#### 1. Phần việc frontend chính
1. Hoàn thiện các trang khám phá nội dung
   - `search` nâng cao
   - `genre / mood / chart` pages
   - trang `related artists`
2. Chuẩn hóa các component hiển thị dữ liệu
   - card bài hát
   - card artist
   - card album
   - table trending
3. Cải thiện responsive cho toàn bộ khu vực homepage
   - mobile menu
   - layout tablet
   - tối ưu spacing và typography cho màn hình nhỏ
4. Nâng cấp trải nghiệm danh sách
   - skeleton loading
   - empty states
   - lazy load / pagination UI
5. Accessibility cơ bản đến nâng cao
   - keyboard navigation
   - focus states
   - aria labels

#### 2. Phần việc backend / logic phối hợp
1. Chuẩn hóa luồng search query từ frontend về backend
2. Làm việc với API trả về dữ liệu danh mục, filter và sorting
3. Kiểm tra contract API cho artist / album / song list để tránh mismatch UI
4. Phối hợp tối ưu cache response cho các trang nhiều dữ liệu

#### 3. Mức độ task để cân bằng
- **Task dễ:** chỉnh UI, responsive, empty state, typography
- **Task trung bình:** search UI, list rendering, filter/sort UI
- **Task khó:** chuẩn hóa design system, tối ưu accessibility, đồng bộ API contract cho nhiều trang

#### 4. Kết quả kỳ vọng
- Giao diện đồng nhất và dễ dùng hơn
- Tăng chất lượng trải nghiệm tìm kiếm và khám phá
- Giảm lỗi hiển thị trên mobile / tablet

---

### B. Đoàn Nhật Cường
**Vai trò chính:** Frontend player, tương tác nghe nhạc, luồng phát bài.

#### 1. Phần việc frontend chính
1. Nâng cấp `PlayerBar`
   - trạng thái đang phát
   - nút next / previous
   - repeat / shuffle
   - progress / seek
2. Hoàn thiện album overlay
   - hiển thị tracklist đẹp hơn
   - play all / shuffle rõ ràng hơn
   - trạng thái loading / error
3. Làm queue panel chi tiết
   - reorder bài hát
   - xóa bài khỏi queue
   - chọn bài đang phát
4. Cải thiện tương tác like / playlist
   - feedback khi bấm like/unlike
   - trạng thái loading khi gọi API
   - thông báo lỗi rõ ràng
5. Nâng cấp recently played
   - reload mượt hơn
   - cập nhật realtime sau khi nghe bài

#### 2. Phần việc backend / logic phối hợp
1. Đồng bộ lịch sử nghe với backend
2. Tối ưu API cho queue / recent plays / favorite status
3. Phối hợp xử lý preload bài hát kế tiếp
4. Hỗ trợ contract dữ liệu cho player mode và album queue

#### 3. Mức độ task để cân bằng
- **Task dễ:** UI state, nút điều khiển, feedback button
- **Task trung bình:** recent plays, album overlay, queue panel đơn giản
- **Task khó:** queue reorder, resume playback, đồng bộ trạng thái player với backend

#### 4. Kết quả kỳ vọng
- Người dùng nghe nhạc mượt hơn và ít gián đoạn hơn
- Player trở nên “đủ dùng như một sản phẩm hoàn chỉnh”
- Các thao tác like / playlist / recent plays ổn định hơn

---

### C. Trần Minh Đức
**Vai trò chính:** Backend, admin, subscription và hệ thống dữ liệu.

#### 1. Phần việc backend chính
1. Xây dựng và hoàn thiện admin dashboard
   - quản lý songs / albums / artists / users
   - thống kê top songs, top artists
   - lọc dữ liệu theo thời gian
2. Mở rộng API cho tìm kiếm và khám phá
   - search filters
   - sorting
   - related content
   - genre / mood / chart APIs
3. Subscription & monetization
   - gói premium
   - billing / invoice
   - phân quyền theo gói
4. Moderation & content workflow
   - upload approval
   - report system
   - audit log
5. Tối ưu hạ tầng dữ liệu
   - index database
   - caching
   - tối ưu query
   - chuẩn hóa response API

#### 2. Phần việc frontend phối hợp
1. Làm dashboard/admin UI ở mức cần thiết để test và vận hành
2. Thiết kế các view hiển thị dữ liệu backend trả về
3. Hỗ trợ frontend team khi cần mock dữ liệu hoặc schema mới
4. Kiểm tra lỗi hiển thị từ dữ liệu thật sau khi API thay đổi

#### 3. Mức độ task để cân bằng
- **Task dễ:** dashboard list view, filter cơ bản, CRUD đơn giản
- **Task trung bình:** subscription flow, report system, thống kê
- **Task khó:** tối ưu database, recommendation data, chuẩn hóa API contract và moderation workflow

#### 4. Kết quả kỳ vọng
- Backend ổn định và dễ mở rộng
- Có nền tảng cho admin và kiếm tiền sau này
- Tạo điều kiện cho frontend hoạt động mượt và ít phải sửa lại nhiều

---

## 4) Bảng cân bằng nhiệm vụ theo độ khó

| Dev | Frontend | Backend | Task dễ | Task khó |
|---|---:|---:|---:|---:|
| Trần Hoàng Duy | Rất nhiều | Vừa | Nhiều | Nhiều |
| Đoàn Nhật Cường | Rất nhiều | Vừa | Nhiều | Nhiều |
| Trần Minh Đức | Vừa | Rất nhiều | Vừa | Nhiều |

### Nhận xét cân bằng
- **Trần Hoàng Duy**: mạnh về giao diện, nhưng vẫn cần chạm vào API contract và tối ưu dữ liệu hiển thị để không bị “chỉ làm UI”.
- **Đoàn Nhật Cường**: tập trung player nên có cả phần trải nghiệm người dùng lẫn logic phát nhạc, đây là mảng có độ khó cao nhưng cũng có nhiều task nhỏ dễ hoàn thành.
- **Trần Minh Đức**: gánh backend nặng nhất, nhưng vẫn có phần frontend hỗ trợ ở dashboard và view dữ liệu để đảm bảo hiểu đúng nhu cầu hiển thị.

---

## 5) Gợi ý chia sprint theo người

### Sprint 1
- **Trần Hoàng Duy**: search nâng cao, responsive, empty states
- **Đoàn Nhật Cường**: PlayerBar controls, like/unlike feedback, album overlay UI
- **Trần Minh Đức**: admin dashboard skeleton, API list cho songs/artists/albums

### Sprint 2
- **Trần Hoàng Duy**: genre/mood/chart pages, accessibility
- **Đoàn Nhật Cường**: queue panel, recent plays, resume playback
- **Trần Minh Đức**: subscription flow, billing schema, phân quyền premium

### Sprint 3
- **Trần Hoàng Duy**: design system, polished cards/tables
- **Đoàn Nhật Cường**: preload, repeat/shuffle, queue reorder
- **Trần Minh Đức**: moderation/report system, indexing, caching, query optimization

---

## 6) Ghi chú điều phối
- Mỗi người nên có cả task “nhanh” để chốt tiến độ và task “khó” để tạo giá trị dài hạn.
- Frontend và backend cần review chéo ở các điểm API contract, đặc biệt là search, player, playlist và album data.
- Nếu một người bị quá tải, ưu tiên chuyển bớt task nhỏ như UI polish, empty state, list rendering hoặc test case sang người còn lại.
- Nên review tiến độ theo tuần để giữ sự cân bằng giữa 3 dev, tránh để backend hoặc frontend bị lệch khối lượng.
