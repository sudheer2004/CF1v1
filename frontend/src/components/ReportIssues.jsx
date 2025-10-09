import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import emailjs from '@emailjs/browser';

export default function ReportIssues({ user }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    email: user?.email || '',
    username: user?.username || 'Guest',
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    // Validation
    if (!formData.subject.trim()) {
      setStatus({ type: 'error', message: 'Please enter a subject' });
      return;
    }
    if (!formData.description.trim()) {
      setStatus({ type: 'error', message: 'Please enter a description' });
      return;
    }
    if (formData.description.length < 20) {
      setStatus({ type: 'error', message: 'Description must be at least 20 characters' });
      return;
    }

    setIsSubmitting(true);

    try {
      // EmailJS configuration - Using environment variables for security
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      // Check if environment variables are set
      if (!serviceId || !templateId || !publicKey) {
        throw new Error('EmailJS configuration is missing. Please contact support.');
      }

      const templateParams = {
        from_name: formData.username,
        from_email: formData.email,
        subject: formData.subject,
        message: formData.description,
        user_rating: user?.rating || 'N/A',
        timestamp: new Date().toLocaleString(),
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);

      setStatus({ 
        type: 'success', 
        message: 'Thank you! Your report has been submitted successfully.' 
      });

      // Reset form
      setFormData({
        subject: '',
        description: '',
        email: user?.email || '',
        username: user?.username || 'Guest',
      });

    } catch (error) {
      console.error('EmailJS Error:', error);
      
      let errorMessage = 'Failed to send report. Please try again later.';
      
      if (error.message && error.message.includes('configuration')) {
        errorMessage = 'Email service is not configured. Please contact support.';
      } else if (error.text && error.text.includes('412')) {
        errorMessage = 'Email service configuration error. Please contact support.';
      } else if (error.text && error.text.includes('authentication')) {
        errorMessage = 'Authentication error. Please contact support.';
      }
      
      setStatus({ 
        type: 'error', 
        message: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Report an Issue</h1>
          <p className="text-gray-400">
            Found a bug, have a suggestion, or want to share feedback? Let us know!
          </p>
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
            status.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/50' 
              : 'bg-red-500/20 border border-red-500/50'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <p className={status.type === 'success' ? 'text-green-300' : 'text-red-300'}>
              {status.message}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Brief summary of the issue"
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              maxLength={100}
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.subject.length}/100 characters
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Your Email (optional)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              We'll use this to follow up on your report
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Please provide as much detail as possible..."
              rows={8}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.description.length}/1000 characters (minimum 20)
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </form>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            Your report will help us improve CF Duel. Thank you for taking the time to share your feedback!
          </p>
        </div>
      </div>
    </div>
  );
}