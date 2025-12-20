// src/services/receiptPdfService.ts
import type { UtilityResultState } from "@/pages/utilities/utilityTypes";

/**
 * Generate and download receipt PDF
 * Uses browser's print functionality to create PDF
 */
export function downloadReceiptPdf(receipt: UtilityResultState): void {
  // Create a new window for printing
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("Không thể mở cửa sổ in. Vui lòng cho phép popup.");
  }

  // Get current date/time for receipt
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN");

  // Build HTML content for receipt
  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biên lai giao dịch - ${receipt.transactionId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
      background: #fff;
      color: #333;
    }
    
    .receipt {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #10b981;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.95;
    }
    
    .status-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 20px;
      margin-top: 12px;
      font-weight: 600;
      font-size: 14px;
    }
    
    .content {
      padding: 30px;
    }
    
    .amount-section {
      text-align: center;
      padding: 25px;
      background: #f0fdf4;
      border-radius: 8px;
      margin-bottom: 25px;
      border: 1px solid #d1fae5;
    }
    
    .amount-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .amount-value {
      font-size: 36px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 8px;
    }
    
    .amount-description {
      font-size: 14px;
      color: #6b7280;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .info-item {
      background: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .info-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
    }
    
    .details-section {
      margin-top: 25px;
      padding-top: 25px;
      border-top: 2px dashed #e5e7eb;
    }
    
    .details-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .details-list {
      list-style: none;
    }
    
    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 15px;
      background: #f9fafb;
      border-radius: 6px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .detail-label {
      font-size: 14px;
      color: #6b7280;
    }
    
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      text-align: right;
      max-width: 60%;
      word-break: break-word;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    
    .footer p {
      margin-bottom: 4px;
    }
    
    .print-date {
      margin-top: 15px;
      font-size: 11px;
      color: #9ca3af;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .receipt {
        border: none;
        max-width: 100%;
      }
      
      @page {
        margin: 1cm;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>BIÊN LAI GIAO DỊCH</h1>
      <p>Ngân hàng số - Digital Banking</p>
      <div class="status-badge">✓ Giao dịch thành công</div>
    </div>
    
    <div class="content">
      <div class="amount-section">
        <div class="amount-label">Số tiền giao dịch</div>
        <div class="amount-value">${receipt.amount} VND</div>
        <div class="amount-description">${receipt.title}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Mã giao dịch</div>
          <div class="info-value">${receipt.transactionId}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Thời gian</div>
          <div class="info-value">${receipt.time}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Phí giao dịch</div>
          <div class="info-value">${receipt.fee}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Trạng thái</div>
          <div class="info-value" style="color: #10b981;">Thành công</div>
        </div>
      </div>
      
      ${
        receipt.details && receipt.details.length > 0
          ? `
      <div class="details-section">
        <div class="details-title">
          📋 Chi tiết giao dịch
        </div>
        <ul class="details-list">
          ${receipt.details
            .map(
              (detail) => `
            <li class="detail-item">
              <span class="detail-label">${detail.label}</span>
              <span class="detail-value">${detail.value || "-"}</span>
            </li>
          `
            )
            .join("")}
        </ul>
      </div>
      `
          : ""
      }
      
      <div class="footer">
        <p><strong>Cảm ơn quý khách đã sử dụng dịch vụ!</strong></p>
        <p>Biên lai này được tạo tự động và có giá trị pháp lý.</p>
        <p>Mọi thắc mắc vui lòng liên hệ: 1900-xxxx hoặc support@bank.vn</p>
        <div class="print-date">
          In lúc: ${dateStr} ${timeStr}
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Auto print when page loads
    window.onload = function() {
      window.print();
      // Close window after printing (optional)
      // window.onafterprint = function() {
      //   window.close();
      // };
    };
  </script>
</body>
</html>
  `;

  // Write content to new window
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Alternative: Download as HTML file
 */
export function downloadReceiptHtml(receipt: UtilityResultState): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN").replace(/\//g, "-");
  const filename = `bien-lai-${receipt.transactionId}-${dateStr}.html`;

  const htmlContent = generateReceiptHtml(receipt);

  // Create blob and download
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateReceiptHtml(receipt: UtilityResultState): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biên lai giao dịch - ${receipt.transactionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f3f4f6; color: #333; }
    .receipt { max-width: 800px; margin: 0 auto; background: white; border: 2px solid #10b981; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
    .header p { font-size: 14px; opacity: 0.95; }
    .status-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 8px 16px; border-radius: 20px; margin-top: 12px; font-weight: 600; font-size: 14px; }
    .content { padding: 30px; }
    .amount-section { text-align: center; padding: 25px; background: #f0fdf4; border-radius: 8px; margin-bottom: 25px; border: 1px solid #d1fae5; }
    .amount-label { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
    .amount-value { font-size: 36px; font-weight: 700; color: #10b981; margin-bottom: 8px; }
    .amount-description { font-size: 14px; color: #6b7280; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
    .info-item { background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; color: #111827; word-break: break-word; }
    .details-section { margin-top: 25px; padding-top: 25px; border-top: 2px dashed #e5e7eb; }
    .details-title { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 15px; }
    .details-list { list-style: none; }
    .detail-item { display: flex; justify-content: space-between; padding: 12px 15px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e5e7eb; }
    .detail-label { font-size: 14px; color: #6b7280; }
    .detail-value { font-size: 14px; font-weight: 600; color: #111827; text-align: right; max-width: 60%; word-break: break-word; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    .footer p { margin-bottom: 4px; }
    .print-date { margin-top: 15px; font-size: 11px; color: #9ca3af; }
    @media print { body { padding: 0; background: white; } .receipt { border: none; max-width: 100%; } @page { margin: 1cm; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>BIÊN LAI GIAO DỊCH</h1>
      <p>Ngân hàng số - Digital Banking</p>
      <div class="status-badge">✓ Giao dịch thành công</div>
    </div>
    <div class="content">
      <div class="amount-section">
        <div class="amount-label">Số tiền giao dịch</div>
        <div class="amount-value">${receipt.amount} VND</div>
        <div class="amount-description">${receipt.title}</div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Mã giao dịch</div><div class="info-value">${
          receipt.transactionId
        }</div></div>
        <div class="info-item"><div class="info-label">Thời gian</div><div class="info-value">${
          receipt.time
        }</div></div>
        <div class="info-item"><div class="info-label">Phí giao dịch</div><div class="info-value">${
          receipt.fee
        }</div></div>
        <div class="info-item"><div class="info-label">Trạng thái</div><div class="info-value" style="color: #10b981;">Thành công</div></div>
      </div>
      ${
        receipt.details && receipt.details.length > 0
          ? `<div class="details-section"><div class="details-title">📋 Chi tiết giao dịch</div><ul class="details-list">${receipt.details
              .map(
                (d) =>
                  `<li class="detail-item"><span class="detail-label">${
                    d.label
                  }</span><span class="detail-value">${
                    d.value || "-"
                  }</span></li>`
              )
              .join("")}</ul></div>`
          : ""
      }
      <div class="footer">
        <p><strong>Cảm ơn quý khách đã sử dụng dịch vụ!</strong></p>
        <p>Biên lai này được tạo tự động và có giá trị pháp lý.</p>
        <p>Mọi thắc mắc vui lòng liên hệ: 1900-xxxx hoặc support@bank.vn</p>
        <div class="print-date">Tạo lúc: ${dateStr} ${timeStr}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
