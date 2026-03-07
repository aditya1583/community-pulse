import UIKit
import WebKit
import Capacitor

class VoxloViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Set WKWebView scroll view background to black so overscroll/rubber-banding
        // doesn't show a gray/white flash above the content
        if let webView = self.webView {
            webView.scrollView.backgroundColor = UIColor.black
            webView.backgroundColor = UIColor.black
            webView.isOpaque = false
            // Disable top bounce to prevent gray flash on scroll-to-top
            webView.scrollView.bounces = false
        }
    }
}
