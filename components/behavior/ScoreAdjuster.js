'use client'

import { useState, useTransition } from 'react'
import { adjustBehaviorScore } from '@/services/behaviorActions'

const PRESET_REASONS = {
    increase: [
        { en: 'On-time payment', th: 'ชำระค่าเช่าตรงเวลา' },
        { en: 'Good room maintenance', th: 'ดูแลห้องพักดี' },
        { en: 'Community contribution', th: 'มีส่วนร่วมในชุมชน' },
        { en: 'Long-term residency bonus', th: 'โบนัสผู้เช่าระยะยาว' },
    ],
    decrease: [
        { en: 'Late payment', th: 'ชำระค่าเช่าล่าช้า' },
        { en: 'Rule violation', th: 'ฝ่าฝืนกฎระเบียบ' },
        { en: 'Property damage', th: 'ทำทรัพย์สินเสียหาย' },
        { en: 'Noise complaint', th: 'ถูกร้องเรียนเรื่องเสียงดัง' },
    ]
}

export default function ScoreAdjuster({ tenantId, currentScore, translations, lang }) {
    const [showModal, setShowModal] = useState(false)
    const [mode, setMode] = useState('increase') // 'increase' or 'decrease'
    const [amount, setAmount] = useState(5)
    const [reason, setReason] = useState('')
    const [customReason, setCustomReason] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isPending, startTransition] = useTransition()

    const t = (key) => translations[key] || key

    const openModal = (type) => {
        setMode(type)
        setAmount(5)
        setReason('')
        setCustomReason('')
        setError('')
        setSuccess('')
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setError('')
        setSuccess('')
    }

    const handleSubmit = () => {
        const finalReason = reason === '__custom__' ? customReason.trim() : reason
        if (!finalReason) {
            setError(t('scoreReasonRequired'))
            return
        }
        if (amount <= 0) {
            setError(t('scoreAmountRequired'))
            return
        }

        const scoreChange = mode === 'increase' ? amount : -amount

        startTransition(async () => {
            const result = await adjustBehaviorScore(tenantId, scoreChange, finalReason)
            if (result.error) {
                setError(result.error)
            } else {
                setSuccess(t('scoreUpdated'))
                setTimeout(() => {
                    closeModal()
                    // Page จะ revalidate อัตโนมัติจาก server action
                }, 1200)
            }
        })
    }

    const presets = PRESET_REASONS[mode] || []

    return (
        <>
            {/* Adjust Buttons */}
            <div className="score-adjust-buttons">
                <button
                    className="btn score-btn score-btn-increase"
                    onClick={() => openModal('increase')}
                    id="btn-increase-score"
                >
                    <span className="score-btn-icon">+</span>
                    {t('increaseScore')}
                </button>
                <button
                    className="btn score-btn score-btn-decrease"
                    onClick={() => openModal('decrease')}
                    id="btn-decrease-score"
                >
                    <span className="score-btn-icon">−</span>
                    {t('decreaseScore')}
                </button>
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="score-modal-overlay" onClick={closeModal}>
                    <div
                        className="score-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className={`score-modal-header ${mode === 'increase' ? 'header-increase' : 'header-decrease'}`}>
                            <div className="score-modal-header-icon">
                                {mode === 'increase' ? '📈' : '📉'}
                            </div>
                            <h3 className="score-modal-title">
                                {mode === 'increase' ? t('increaseScore') : t('decreaseScore')}
                            </h3>
                            <button className="score-modal-close" onClick={closeModal}>✕</button>
                        </div>

                        {/* Modal Body */}
                        <div className="score-modal-body">
                            {/* Current Score Display */}
                            <div className="score-modal-current">
                                <span className="score-modal-current-label">{t('currentScore')}</span>
                                <span className="score-modal-current-value">{currentScore}</span>
                                <span className="score-modal-arrow">→</span>
                                <span className={`score-modal-new-value ${mode === 'increase' ? 'text-success' : 'text-danger'}`}>
                                    {mode === 'increase'
                                        ? Math.min(200, currentScore + amount)
                                        : Math.max(0, currentScore - amount)
                                    }
                                </span>
                            </div>

                            {/* Amount Selector */}
                            <div className="score-modal-field">
                                <label className="score-modal-label">{t('scoreAmount')}</label>
                                <div className="score-amount-selector">
                                    {[5, 10, 15, 20, 25].map((val) => (
                                        <button
                                            key={val}
                                            className={`score-amount-btn ${amount === val ? 'active' : ''} ${mode === 'increase' ? 'amount-increase' : 'amount-decrease'}`}
                                            onClick={() => setAmount(val)}
                                        >
                                            {mode === 'increase' ? '+' : '−'}{val}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        className="score-amount-custom"
                                        min="1"
                                        max="100"
                                        value={amount}
                                        onChange={(e) => setAmount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    />
                                </div>
                            </div>

                            {/* Reason Selector */}
                            <div className="score-modal-field">
                                <label className="score-modal-label">{t('scoreReason')}</label>
                                <div className="score-reason-grid">
                                    {presets.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            className={`score-reason-btn ${reason === preset[lang] ? 'active' : ''}`}
                                            onClick={() => {
                                                setReason(preset[lang])
                                                setCustomReason('')
                                            }}
                                        >
                                            {preset[lang]}
                                        </button>
                                    ))}
                                    <button
                                        className={`score-reason-btn ${reason === '__custom__' ? 'active' : ''}`}
                                        onClick={() => setReason('__custom__')}
                                    >
                                        ✏️ {t('customReason')}
                                    </button>
                                </div>
                                {reason === '__custom__' && (
                                    <textarea
                                        className="score-custom-input"
                                        placeholder={t('enterReason')}
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        rows={2}
                                    />
                                )}
                            </div>

                            {/* Error/Success Messages */}
                            {error && <div className="score-modal-error">{error}</div>}
                            {success && <div className="score-modal-success">{success}</div>}
                        </div>

                        {/* Modal Footer */}
                        <div className="score-modal-footer">
                            <button className="btn btn-outline" onClick={closeModal}>
                                {t('cancel')}
                            </button>
                            <button
                                className={`btn ${mode === 'increase' ? 'score-btn-confirm-increase' : 'score-btn-confirm-decrease'}`}
                                onClick={handleSubmit}
                                disabled={isPending}
                                id="btn-confirm-score"
                            >
                                {isPending ? t('saving') : t('confirmAdjust')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
