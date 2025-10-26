"""
Report Generator
Version: 2.0.0
Updated: 2025-10-26 06:10:45 UTC
Developer: charlesms-eth
License: MIT (FREE OPEN SOURCE)

Generates audit reports in PDF and Markdown formats.
"""

import os
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path


class ReportGenerator:
    """
    Generator for audit reports
    
    Supports:
    - PDF reports (professional formatting)
    - Markdown reports (developer-friendly)
    - JSON reports (programmatic access)
    """
    
    def __init__(self):
        """Initialize report generator"""
        print("   ✓ Report Generator initialized")
    
    async def generate_pdf(
        self,
        audit_result: Dict[str, Any],
        output_path: str
    ) -> str:
        """
        Generate PDF audit report
        
        Args:
            audit_result: Complete audit results
            output_path: Path to save PDF file
        
        Returns:
            Path to generated PDF file
        """
        
        # For MVP, we'll create a simple text-based PDF
        # In production, use reportlab or similar library
        
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
            from reportlab.lib.units import inch
            
            # Create PDF document
            doc = SimpleDocTemplate(output_path, pagesize=letter)
            story = []
            styles = getSampleStyleSheet()
            
            # Title
            title = Paragraph(
                f"<b>Markov Security Audit Report</b><br/>{audit_result['contract_name']}",
                styles['Title']
            )
            story.append(title)
            story.append(Spacer(1, 0.5*inch))
            
            # Summary
            summary = audit_result['summary']
            summary_text = f"""
            <b>Audit Date:</b> {audit_result['audit_date']}<br/>
            <b>Contract:</b> {audit_result['contract_name']}<br/>
            <b>Risk Score:</b> {audit_result['risk_score']}/10<br/>
            <br/>
            <b>Summary:</b><br/>
            Total Checks: {summary['total_checks']}<br/>
            Passed: {summary['passed_checks']}<br/>
            Critical Issues: {summary['critical_issues']}<br/>
            High Issues: {summary['high_issues']}<br/>
            Medium Issues: {summary['medium_issues']}<br/>
            Low Issues: {summary['low_issues']}<br/>
            """
            
            story.append(Paragraph(summary_text, styles['Normal']))
            story.append(Spacer(1, 0.3*inch))
            
            # Build PDF
            doc.build(story)
            
            return output_path
            
        except ImportError:
            # Fallback: Generate simple text file if reportlab not available
            return await self._generate_text_report(audit_result, output_path)
    
    async def generate_markdown(
        self,
        audit_result: Dict[str, Any],
        output_path: str
    ) -> str:
        """
        Generate Markdown audit report
        
        Args:
            audit_result: Complete audit results
            output_path: Path to save MD file
        
        Returns:
            Path to generated Markdown file
        """
        
        md_content = self._build_markdown_content(audit_result)
        
        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return output_path
    
    def _build_markdown_content(self, result: Dict[str, Any]) -> str:
        """Build markdown content from audit result"""
        
        summary = result['summary']
        
        md = f"""# Markov Security Audit Report

**Contract:** {result['contract_name']}  
**Audit Date:** {result['audit_date']}  
**Risk Score:** {result['risk_score']}/10

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Checks | {summary['total_checks']} |
| Passed | {summary['passed_checks']} |
| **Critical Issues** | **{summary['critical_issues']}** |
| **High Issues** | **{summary['high_issues']}** |
| Medium Issues | {summary['medium_issues']} |
| Low Issues | {summary['low_issues']} |

---

## MeTTa Insights

"""
        
        # Add insights
        for insight in result.get('metta_insights', []):
            md += f"- {insight}\n"
        
        md += "\n---\n\n## Findings by Category\n\n"
        
        # Add findings by category
        for category, findings in result.get('criteria', {}).items():
            md += f"### {category}\n\n"
            
            issues = findings.get('issues', [])
            if issues:
                for issue in issues:
                    severity = issue.get('severity', 'low').upper()
                    md += f"#### [{severity}] {issue.get('title', 'Unknown')}\n\n"
                    md += f"**Location:** {issue.get('location', 'N/A')}  \n"
                    md += f"**Description:** {issue.get('description', 'N/A')}\n\n"
                    md += f"**Recommendation:**  \n{issue.get('recommendation', 'N/A')}\n\n"
            else:
                md += "✅ No issues found in this category.\n\n"
        
        md += "---\n\n## Recommendations\n\n"
        
        # Add recommendations
        for i, rec in enumerate(result.get('recommendations', []), 1):
            md += f"{i}. {rec}\n"
        
        md += f"""

---

## Report Information

**Generated by:** Markov Audit System v2.0.0  
**Developer:** charlesms-eth  
**License:** MIT (FREE OPEN SOURCE)  
**Website:** https://github.com/charlesms-eth/markov-audit

---

*This report was generated automatically using AI-powered analysis with MeTTa reasoning.
Always conduct professional security audits before deploying to mainnet.*
"""
        
        return md
    
    async def _generate_text_report(
        self,
        audit_result: Dict[str, Any],
        output_path: str
    ) -> str:
        """Generate simple text report (fallback for PDF)"""
        
        # Convert markdown to plain text
        md_content = self._build_markdown_content(audit_result)
        
        # Remove markdown formatting
        text_content = md_content.replace('**', '').replace('##', '').replace('###', '')
        
        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text_content)
        
        return output_path