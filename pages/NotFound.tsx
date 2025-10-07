import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-800">
      <h1 className="text-9xl font-extrabold text-primary">404</h1>
      <h2 className="text-4xl font-bold mt-4">Không tìm thấy trang</h2>
      <p className="text-gray-500 mt-2">Xin lỗi, trang bạn đang tìm kiếm không tồn tại.</p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors duration-200"
      >
        Về bảng điều khiển
      </Link>
    </div>
  );
};

export default NotFound;