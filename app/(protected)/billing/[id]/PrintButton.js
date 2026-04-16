'use client'

export default function PrintButton() {
    return (
        <button
            className="btn btn-outline"
            onClick={() => window.print()}
        >
            🖨️ Print
        </button>
    )
}
