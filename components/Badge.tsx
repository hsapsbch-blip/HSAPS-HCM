import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode'; // hoặc dùng window.QRCode nếu bạn load script ngoài

interface BadgeProps {
  submission: { attendance_id?: string; full_name?: string; attendee_type?: string };
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ submission }, ref) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const qrContent = submission.attendance_id || '';
    const displaySize = 110; // hiển thị 110px
    const marginModules = 2; // quiet zone tối thiểu theo chuẩn

    const dpr = window.devicePixelRatio || 1;
    // Thiết lập kích thước "nội bộ" canvas (pixel) cho xuất file rõ nét
    canvas.width = Math.round(displaySize * dpr);
    canvas.height = Math.round(displaySize * dpr);
    // Thiết lập kích thước CSS hiển thị (bằng px bình thường)
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.style.display = 'block';
    canvas.style.background = '#fff';

    // Clear + fill white để khi export không bị trong suốt
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Vẽ QR với width = internal pixel width (để library vẽ đúng tỉ lệ với DPR)
    QRCode.toCanvas(
      canvas,
      qrContent,
      { width: canvas.width, margin: marginModules, errorCorrectionLevel: 'H' },
      (err: any) => {
        if (err) console.error('QR Code generation error:', err);
      }
    );
  }, [submission]);

  const badgeStyle: React.CSSProperties = {
    width: '302px',
    height: '189px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '3px',
    backgroundColor: 'white',
    border: '1px solid #E2E8F0',
    boxSizing: 'border-box',
    color: '#1A202C',
  };

  const qrSectionStyle: React.CSSProperties = {
    flexShrink: 0,
    paddingTop: '1px',
    paddingBottom: '3px', // khoảng cách rõ ràng giữa QR và text
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  };

  const infoSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexGrow: 1,
    width: '100%',
    padding: '4px 8px',
    boxSizing: 'border-box',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: '#000',
    lineHeight: 1.15,
    whiteSpace: 'normal',           // cho phép xuống dòng nếu quá dài
    overflowWrap: 'break-word',
    textAlign: 'center',
  };

  const typeStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#4A5568',
    margin: 0,
  };

  return (
    <div ref={ref} style={badgeStyle}>
      <div style={qrSectionStyle}>
        <canvas ref={qrCanvasRef} />
      </div>
      <div style={infoSectionStyle}>
        <p style={nameStyle} title={submission.full_name}>{submission.full_name}</p>
        <p style={typeStyle}>{submission.attendee_type}</p>
      </div>
    </div>
  );
});

export default Badge;
