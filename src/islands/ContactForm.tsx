import { useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export default function ContactForm({ messagePlaceholder = "How can we help you? Feel free to get in touch!", buttonLabel = "Get in Touch" }: { messagePlaceholder?: string; buttonLabel?: string }) {
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", subject: "", message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreementError, setAgreementError] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const agreementCheckboxRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionSuccess(false);
    if (!agreed) {
      setAgreementError(true);
      toast.error("Please check the privacy policy agreement before sending your message.");
      agreementCheckboxRef.current?.focus();
      return;
    }
    setAgreementError(false);
    setIsSubmitting(true);
    try {
      await apiFetch("/v1/contact", { method: "POST", body: JSON.stringify(formData) });
      toast.success("Message sent successfully!");
      setSubmissionSuccess(true);
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      setAgreed(false);
    } catch (error) {
      setSubmissionSuccess(false);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {submissionSuccess && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Your message has been sent successfully. Thank you for getting in touch.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-8">
        <label className="flex items-center gap-3 border-b border-[#c7d0de] pb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <input type="text" placeholder="Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-transparent text-[15px] text-primary placeholder:text-[#8f9bb2] outline-none" />
        </label>
        <label className="flex items-center gap-3 border-b border-[#c7d0de] pb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary"><circle cx="12" cy="12" r="4" /><path d="M16 8v5a2 2 0 1 0 4 0v-1a8 8 0 1 0-4 6.93" /></svg>
          <input type="email" placeholder="Email Address" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-transparent text-[15px] text-primary placeholder:text-[#8f9bb2] outline-none" />
        </label>
        <label className="flex items-center gap-3 border-b border-[#c7d0de] pb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
          <input type="tel" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-transparent text-[15px] text-primary placeholder:text-[#8f9bb2] outline-none" />
        </label>
        <label className="flex items-center gap-3 border-b border-[#c7d0de] pb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary"><path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z" /><path d="M7 7h.01" /></svg>
          <input type="text" placeholder="Subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="w-full bg-transparent text-[15px] text-primary placeholder:text-[#8f9bb2] outline-none" />
        </label>
      </div>
      <label className="flex items-start gap-3 border-b border-[#c7d0de] pb-10">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary mt-1"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        <textarea rows={1} required placeholder={messagePlaceholder} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full bg-transparent text-[15px] text-primary placeholder:text-[#8f9bb2] outline-none resize-none" />
      </label>
      <div className="flex flex-wrap items-center gap-8">
        <button type="submit" disabled={isSubmitting} className="h-[56px] px-10 bg-orange text-white text-[16px] font-semibold inline-flex items-center gap-3 hover:bg-orange-hover disabled:opacity-50 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
          {isSubmitting ? "Sending..." : buttonLabel}
        </button>
        <div>
          <label className={`inline-flex items-center gap-3 rounded-md text-[15px] cursor-pointer ${agreementError ? "border border-red-500 bg-red-50 p-2 text-red-700" : "text-[#8f9bb2]"}`}>
            <input
              ref={agreementCheckboxRef}
              type="checkbox"
              checked={agreed}
              aria-invalid={agreementError}
              aria-describedby={agreementError ? "privacy-consent-error" : undefined}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setAgreementError(false);
              }}
              className="w-4 h-4 accent-orange"
            />
            <span>I agree to the <a href="/privacy-policy" className="underline hover:text-primary transition-colors">privacy policy.</a></span>
          </label>
          {agreementError && (
            <p id="privacy-consent-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
              Please check this box to agree to the privacy policy before sending your message.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
