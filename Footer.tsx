import React, { useState } from "react";
import { SupportForm } from "components/SupportForm";

export const Footer = () => {
  const [showSupportForm, setShowSupportForm] = useState(false);

  return (
    <>
      <footer className="bg-black text-yellow-400 border-t border-yellow-400/20 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* First line - Copyright */}
          <div className="text-center mb-4">
            <p className="text-sm">
              © {new Date().getFullYear()} Letterbox.es - All rights reserved
            </p>
          </div>
          
          {/* Second line - Links */}
          <div className="flex justify-center items-center space-x-6 text-sm">
            <a 
              href="https://www.letterbox.es/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition-colors duration-200"
            >
              Terms of Service
            </a>
            <span className="text-yellow-400/40">|</span>
            <a 
              href="https://www.letterbox.es/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow-300 transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="text-yellow-400/40">|</span>
            <button
              onClick={() => setShowSupportForm(true)}
              className="hover:text-yellow-300 transition-colors duration-200 underline"
            >
              Support
            </button>
          </div>
        </div>
      </footer>
      
      {/* Support Form Modal */}
      <SupportForm 
        isOpen={showSupportForm}
        onClose={() => setShowSupportForm(false)}
      />
    </>
  );
};
