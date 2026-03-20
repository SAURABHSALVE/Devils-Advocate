from fpdf import FPDF
from datetime import datetime
import os
import re


def clean_text(text):
    """Remove Unicode characters that fpdf can't handle"""
    replacements = {
        '→': '->', '←': '<-', '✅': '[OK]', '❌': '[X]',
        '⚖️': '', '📊': '', '📈': '', '😈': '', '🏛️': '',
        '•': '-', '–': '-', '—': '-',
        '\u201c': '"', '\u201d': '"', '\u2018': "'", '\u2019': "'",
        '\u2026': '...', '**': '',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = text.encode('latin-1', errors='replace').decode('latin-1')
    return text


def generate_strategy_brief_pdf(question, moderator_text, session_id):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 28)
    pdf.cell(0, 18, "Shadow Board", ln=True, align="C")

    pdf.set_font("Helvetica", "", 14)
    pdf.cell(0, 10, "Strategy Brief", ln=True, align="C")

    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 8, f"Generated: {datetime.now().strftime('%B %d, %Y')}", ln=True, align="C")
    pdf.ln(8)

    # Divider line
    pdf.set_draw_color(180, 160, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # Question
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Strategic Question:", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, clean_text(question))
    pdf.ln(6)

    # Parse and render moderator text
    lines = moderator_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            pdf.ln(3)
            i += 1
            continue

        # Section headers (## HEADER)
        if line.startswith('## '):
            header = clean_text(line.replace('## ', ''))
            pdf.ln(4)
            # Gold-ish background for headers
            pdf.set_fill_color(240, 230, 200)
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 8, f"  {header}", ln=True, fill=True)
            pdf.ln(2)
            i += 1
            continue

        # Table detection
        if '|' in line and i + 1 < len(lines) and '---' in lines[i + 1]:
            # Parse table header
            headers = [clean_text(h.strip()) for h in line.split('|') if h.strip()]
            i += 2  # skip header and separator line

            # Collect table rows
            rows = []
            while i < len(lines) and '|' in lines[i]:
                row = [clean_text(c.strip()) for c in lines[i].split('|') if c.strip()]
                rows.append(row)
                i += 1

            # Calculate column widths
            num_cols = len(headers)
            if num_cols == 4:
                col_widths = [60, 30, 30, 50]
            elif num_cols == 3:
                col_widths = [60, 50, 60]
            else:
                col_widths = [170 // num_cols] * num_cols

            # Draw table header
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_fill_color(230, 220, 190)
            for j, header in enumerate(headers):
                w = col_widths[j] if j < len(col_widths) else 40
                pdf.cell(w, 7, header, border=1, fill=True)
            pdf.ln()

            # Draw table rows
            pdf.set_font("Helvetica", "", 8)
            for row in rows:
                max_h = 7
                for j, cell in enumerate(row):
                    w = col_widths[j] if j < len(col_widths) else 40
                    pdf.cell(w, max_h, cell[:50], border=1)  # truncate long cells
                pdf.ln()

            pdf.ln(3)
            continue

        # Bullet points (- item)
        if line.startswith('- '):
            pdf.set_font("Helvetica", "", 9)
            bullet_text = clean_text(line[2:])
            pdf.multi_cell(0, 5, f"  - {bullet_text}")
            pdf.ln(1)
            i += 1
            continue

        # Bold option lines (Option A:, Option B:, etc)
        if line.startswith('Option ') or line.startswith('**Option'):
            pdf.set_font("Helvetica", "B", 9)
            option_text = clean_text(line)
            pdf.multi_cell(0, 5, option_text)
            pdf.ln(1)
            i += 1
            continue

        # Numbered items (1. 2. 3.)
        if len(line) > 2 and line[0].isdigit() and line[1] == '.':
            pdf.set_font("Helvetica", "", 9)
            pdf.multi_cell(0, 5, clean_text(line))
            pdf.ln(1)
            i += 1
            continue

        # Regular text
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, clean_text(line))
        i += 1

    # Footer
    pdf.ln(10)
    pdf.set_draw_color(180, 160, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 8, "Shadow Board by Agent Quorum | Powered by AIRIA", ln=True, align="C")

    # Save
    filepath = f"reports/strategy_brief_{session_id}.pdf"
    os.makedirs("reports", exist_ok=True)
    pdf.output(filepath)

    return filepath


def _render_moderator_text(pdf, text):
    """Shared renderer for moderator/comparison text blocks."""
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            pdf.ln(3)
            i += 1
            continue

        if line.startswith('## '):
            header = clean_text(line.replace('## ', ''))
            pdf.ln(4)
            pdf.set_fill_color(240, 230, 200)
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 8, f"  {header}", ln=True, fill=True)
            pdf.ln(2)
            i += 1
            continue

        if '|' in line and i + 1 < len(lines) and '---' in lines[i + 1]:
            headers = [clean_text(h.strip()) for h in line.split('|') if h.strip()]
            i += 2
            rows = []
            while i < len(lines) and '|' in lines[i]:
                row = [clean_text(c.strip()) for c in lines[i].split('|') if c.strip()]
                rows.append(row)
                i += 1

            num_cols = len(headers)
            if num_cols == 4:
                col_widths = [50, 35, 35, 50]
            elif num_cols == 3:
                col_widths = [60, 50, 60]
            else:
                col_widths = [170 // num_cols] * num_cols

            pdf.set_font("Helvetica", "B", 8)
            pdf.set_fill_color(230, 220, 190)
            for j, header in enumerate(headers):
                w = col_widths[j] if j < len(col_widths) else 40
                pdf.cell(w, 7, header[:30], border=1, fill=True)
            pdf.ln()

            pdf.set_font("Helvetica", "", 8)
            for row in rows:
                for j, cell in enumerate(row):
                    w = col_widths[j] if j < len(col_widths) else 40
                    pdf.cell(w, 7, cell[:50], border=1)
                pdf.ln()
            pdf.ln(3)
            continue

        if line.startswith('- '):
            pdf.set_font("Helvetica", "", 9)
            bullet_text = clean_text(line[2:])
            pdf.multi_cell(0, 5, f"  - {bullet_text}")
            pdf.ln(1)
            i += 1
            continue

        if line.startswith('Option ') or line.startswith('**Option'):
            pdf.set_font("Helvetica", "B", 9)
            pdf.multi_cell(0, 5, clean_text(line))
            pdf.ln(1)
            i += 1
            continue

        if len(line) > 2 and line[0].isdigit() and line[1] == '.':
            pdf.set_font("Helvetica", "", 9)
            pdf.multi_cell(0, 5, clean_text(line))
            pdf.ln(1)
            i += 1
            continue

        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, clean_text(line))
        i += 1


def _render_agent_section(pdf, title, agents_dict, header_color):
    """Render a section with all agent outputs (research, debate, etc.)."""
    pdf.ln(4)
    r, g, b = header_color
    pdf.set_fill_color(r, g, b)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 8, f"  {clean_text(title)}", ln=True, fill=True)
    pdf.ln(3)

    for agent_name, text in agents_dict.items():
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(0, 6, clean_text(agent_name), ln=True)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 8)
        pdf.multi_cell(0, 4.5, clean_text(text))
        pdf.ln(3)


def generate_comparison_pdf(option_a, option_b, result_a, result_b,
                            comparison_text, comparison_id):
    """Generate a comprehensive PDF comparing two strategic scenarios with all agent outputs."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Title
    pdf.set_font("Helvetica", "B", 28)
    pdf.cell(0, 18, "Shadow Board", ln=True, align="C")

    pdf.set_font("Helvetica", "", 14)
    pdf.cell(0, 10, "Scenario Comparison Brief", ln=True, align="C")

    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 8, f"Generated: {datetime.now().strftime('%B %d, %Y')}", ln=True, align="C")
    pdf.ln(8)

    pdf.set_draw_color(180, 160, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # Options being compared
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Scenarios Compared:", ln=True)
    pdf.set_font("Helvetica", "B", 10)
    pdf.multi_cell(0, 6, clean_text(f"Option A: {option_a}"))
    pdf.ln(2)
    pdf.multi_cell(0, 6, clean_text(f"Option B: {option_b}"))
    pdf.ln(6)

    pdf.set_draw_color(180, 160, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # ═══ OPTION A — Full Debate Output ═══
    pdf.add_page()
    pdf.set_fill_color(200, 220, 240)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, f"  OPTION A: {clean_text(option_a[:70])}", ln=True, fill=True)
    pdf.ln(4)

    # Research
    _render_agent_section(pdf, "RESEARCH PHASE", result_a["research"], (220, 230, 245))

    # Debate Round 1
    _render_agent_section(pdf, "DEBATE ROUND 1 - OPENING STATEMENTS", result_a["debate_r1"], (210, 225, 240))

    # Debate Round 2
    _render_agent_section(pdf, "DEBATE ROUND 2 - REBUTTALS", result_a["debate_r2"], (200, 220, 235))

    # Final Positions
    _render_agent_section(pdf, "FINAL POSITIONS", result_a["final_positions"], (190, 215, 230))

    # Moderator Synthesis
    pdf.ln(4)
    pdf.set_fill_color(180, 210, 240)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "  MODERATOR SYNTHESIS", ln=True, fill=True)
    pdf.ln(3)
    _render_moderator_text(pdf, result_a["moderator"])
    pdf.ln(6)

    # ═══ OPTION B — Full Debate Output ═══
    pdf.add_page()
    pdf.set_fill_color(220, 240, 200)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, f"  OPTION B: {clean_text(option_b[:70])}", ln=True, fill=True)
    pdf.ln(4)

    # Research
    _render_agent_section(pdf, "RESEARCH PHASE", result_b["research"], (230, 245, 220))

    # Debate Round 1
    _render_agent_section(pdf, "DEBATE ROUND 1 - OPENING STATEMENTS", result_b["debate_r1"], (225, 240, 210))

    # Debate Round 2
    _render_agent_section(pdf, "DEBATE ROUND 2 - REBUTTALS", result_b["debate_r2"], (220, 235, 200))

    # Final Positions
    _render_agent_section(pdf, "FINAL POSITIONS", result_b["final_positions"], (215, 230, 190))

    # Moderator Synthesis
    pdf.ln(4)
    pdf.set_fill_color(210, 240, 180)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "  MODERATOR SYNTHESIS", ln=True, fill=True)
    pdf.ln(3)
    _render_moderator_text(pdf, result_b["moderator"])
    pdf.ln(6)

    # ═══ COMPARATIVE ANALYSIS ═══
    pdf.add_page()
    pdf.set_fill_color(240, 220, 200)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, "  COMPARATIVE ANALYSIS", ln=True, fill=True)
    pdf.ln(4)
    _render_moderator_text(pdf, comparison_text)

    # Footer
    pdf.ln(10)
    pdf.set_draw_color(180, 160, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 8, "Shadow Board Scenario Comparison | Powered by AIRIA", ln=True, align="C")

    filepath = f"reports/comparison_{comparison_id}.pdf"
    os.makedirs("reports", exist_ok=True)
    pdf.output(filepath)
    return filepath