import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

export async function exportToPDF(
  element: HTMLElement,
  fileName = 'レポート.pdf',
): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  })

  const img = new Image()
  img.src = dataUrl
  await new Promise((resolve) => {
    img.onload = resolve
  })

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 5

  const imgWidth = pageWidth - margin * 2
  const imgHeight = (img.height * imgWidth) / img.width

  if (imgHeight > pageHeight - margin * 2) {
    const scaledHeight = pageHeight - margin * 2
    const scaledWidth = (img.width * scaledHeight) / img.height
    const xOffset = (pageWidth - scaledWidth) / 2
    pdf.addImage(dataUrl, 'PNG', xOffset, margin, scaledWidth, scaledHeight)
  } else {
    pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight)
  }

  pdf.save(fileName)
}
