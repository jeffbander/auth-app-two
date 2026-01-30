import { jsPDF } from "jspdf";

type AttestationData = {
  patientName: string;
  patientDob: string;
  mrn: string;
  dateOfService: string;
  studyOrdered: string;
  rationale: string;
  attestationContent: string | null;
  physicianName: string;
  physicianCredentials: string;
  physicianNpi: string;
  signatureImageUrl: string | null;
  letterDate: string;
};

export function generateAttestationPdf(data: AttestationData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 72; // 1 inch
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header - centered
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("MSW HEART CARDIOLOGY", pageWidth / 2, y, { align: "center" });
  y += 18;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "1000 10th Ave Lobby Level, New York, NY 10019",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 14;
  doc.text("Phone: (212) 752-2700", pageWidth / 2, y, { align: "center" });
  y += 20;

  // Line separator
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Date
  doc.setFontSize(11);
  doc.text(`Date: ${data.letterDate}`, margin, y);
  y += 24;

  // RE line
  doc.setFont("helvetica", "bold");
  doc.text("RE: Authorization Request for Cardiology Study", margin, y);
  y += 24;

  // Patient info
  doc.setFont("helvetica", "normal");
  const patientInfo = [
    `Patient Name: ${data.patientName}`,
    `Date of Birth: ${data.patientDob}`,
    `MRN: ${data.mrn}`,
    `Date of Service: ${data.dateOfService}`,
  ];

  for (const line of patientInfo) {
    doc.text(line, margin, y);
    y += 16;
  }
  y += 8;

  // Study ordered
  doc.setFont("helvetica", "bold");
  doc.text(`Study Ordered: ${data.studyOrdered}`, margin, y);
  y += 24;

  // Clinical content - use structured attestationContent if available, otherwise fall back to rationale
  const clinicalText = data.attestationContent || data.rationale;

  // Parse structured sections from attestationContent
  const sectionHeaders = [
    "CURRENT SIGNS AND SYMPTOMS:",
    "PRIOR DIAGNOSTIC STUDIES AND RESULTS:",
    "PRIOR MANAGEMENT AND CONSERVATIVE THERAPIES:",
    "MEDICATIONS:",
    "JUSTIFICATION FOR ECHOCARDIOGRAM OUTSIDE 60-DAY WINDOW:",
    "DOCUMENTATION CONFLICT RESOLUTION:",
  ];

  const hasStructuredSections = sectionHeaders.some((header) =>
    clinicalText.includes(header)
  );

  doc.setFontSize(10);

  if (hasStructuredSections) {
    // Render each section with bold headers
    const sections = clinicalText.split(/\n\n+/);
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Check if this section starts with a known header
      const matchedHeader = sectionHeaders.find((h) => trimmed.startsWith(h));
      if (matchedHeader) {
        // Bold header
        if (y > 660) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.text(matchedHeader, margin, y);
        y += 16;

        // Normal content after the header
        const content = trimmed.slice(matchedHeader.length).trim();
        if (content) {
          doc.setFont("helvetica", "normal");
          const contentLines = doc.splitTextToSize(content, contentWidth);
          for (const line of contentLines) {
            if (y > 680) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin, y);
            y += 14;
          }
        }
        y += 8;
      } else {
        // Unstructured content block
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(trimmed, contentWidth);
        for (const line of lines) {
          if (y > 680) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += 14;
        }
        y += 4;
      }
    }
  } else {
    // Fallback: render as single "Clinical Rationale" block
    doc.setFont("helvetica", "bold");
    doc.text("Clinical Rationale:", margin, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    const rationaleLines = doc.splitTextToSize(clinicalText, contentWidth);
    for (const line of rationaleLines) {
      if (y > 680) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 14;
    }
  }

  // Signature section - position near bottom
  y = Math.max(y + 40, 580);

  // Signature image
  if (data.signatureImageUrl) {
    try {
      doc.addImage(data.signatureImageUrl, "PNG", margin, y - 50, 150, 50);
    } catch {
      // If image fails, leave blank
    }
  }

  // Signature line
  doc.setDrawColor(0);
  doc.line(margin, y, margin + 200, y);
  y += 16;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const credLine = data.physicianCredentials
    ? `${data.physicianName}, ${data.physicianCredentials}`
    : data.physicianName;
  doc.text(credLine, margin, y);
  y += 14;

  if (data.physicianNpi) {
    doc.text(`NPI: ${data.physicianNpi}`, margin, y);
  } else {
    doc.setTextColor(180, 0, 0);
    doc.text("NPI: Not on file", margin, y);
    doc.setTextColor(0, 0, 0);
  }

  if (!data.signatureImageUrl) {
    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("[Signature Required]", margin, y);
    doc.setTextColor(0, 0, 0);
  }

  // Download
  const fileName = `attestation_${data.mrn}_${data.dateOfService}.pdf`;
  doc.save(fileName);
}
