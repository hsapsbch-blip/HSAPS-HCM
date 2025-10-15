import React, { useState, useEffect } from 'react';
import { EventDocument } from '../types';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ShareDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: EventDocument | null;
}

const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({ isOpen, onClose, document }) => {
  const { addToast } = useToast();
  const [zaloNumber, setZaloNumber] = useState('');
  const [fromZaloNumber, setFromZaloNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (document) {
      setMessage(`Chào bạn, tôi muốn chia sẻ với bạn tài liệu "${document.name}".\n\nBạn có thể xem hoặc tải về tại đây:\n${document.file_url}`);
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(document.file_url)
      .then(() => {
        addToast('Đã sao chép liên kết!', 'success');
      })
      .catch(err => {
        addToast('Không thể sao chép liên kết.', 'error');
        console.error('Clipboard copy failed:', err);
      });
  };

  const handleSendZalo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zaloNumber || !fromZaloNumber) {
      addToast('Vui lòng nhập SĐT Zalo của bạn và người nhận.', 'warning');
      return;
    }
    setIsSending(true);
    
    try {
      const { error: invokeError } = await supabase.functions.invoke('send-abitstore-zalo', {
        body: {
          send_from_number: fromZaloNumber,
          send_to_number: zaloNumber,
          message: message,
        },
      });

      if (invokeError) throw invokeError;
      
      addToast('Tin nhắn đã được gửi qua Zalo!', 'success');
      onClose();

    } catch (err: any) {
      const errorMessage = err.context?.data?.error || err.message || "Đã xảy ra lỗi khi gửi tin nhắn.";
      addToast(`Lỗi: ${errorMessage}`, 'error');
      console.error("Zalo send error:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-bold text-gray-800">Chia sẻ tài liệu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="font-semibold text-gray-900 truncate" title={document.name}>{document.name}</p>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Liên kết chia sẻ</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                readOnly
                value={document.file_url}
                className="focus:ring-primary focus:border-primary flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 bg-gray-50"
              />
              <button
                onClick={handleCopyToClipboard}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Sao chép
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSendZalo} className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold text-gray-800">Gửi qua Zalo (qua Abitstore)</h3>
            <p className="text-sm text-gray-500 mt-1">Lưu ý: Tính năng này yêu cầu SĐT Zalo của bạn đã được liên kết với Abitstore.</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="from-zalo-number" className="block text-sm font-medium text-gray-700">SĐT Zalo của bạn</label>
                    <input
                        type="tel"
                        id="from-zalo-number"
                        value={fromZaloNumber}
                        onChange={(e) => setFromZaloNumber(e.target.value)}
                        placeholder="VD: 0901234567"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="zalo-number" className="block text-sm font-medium text-gray-700">SĐT Zalo người nhận</label>
                    <input
                        type="tel"
                        id="zalo-number"
                        value={zaloNumber}
                        onChange={(e) => setZaloNumber(e.target.value)}
                        placeholder="VD: 0987654321"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        required
                    />
                </div>
            </div>

            <div className="mt-4">
                <label htmlFor="zalo-message" className="block text-sm font-medium text-gray-700">Nội dung tin nhắn</label>
                <textarea
                    id="zalo-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                />
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                    {isSending ? 'Đang gửi...' : 'Gửi Zalo'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ShareDocumentModal;
