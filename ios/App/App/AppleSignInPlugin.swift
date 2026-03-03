import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var savedCall: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        savedCall = call

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            savedCall?.reject("Invalid credential type")
            savedCall = nil
            return
        }

        var result: [String: Any] = [:]

        if let identityToken = credential.identityToken,
           let tokenString = String(data: identityToken, encoding: .utf8) {
            result["identityToken"] = tokenString
        }

        if let authCode = credential.authorizationCode,
           let codeString = String(data: authCode, encoding: .utf8) {
            result["authorizationCode"] = codeString
        }

        result["user"] = credential.user

        if let email = credential.email {
            result["email"] = email
        }

        if let givenName = credential.fullName?.givenName {
            result["givenName"] = givenName
        }

        if let familyName = credential.fullName?.familyName {
            result["familyName"] = familyName
        }

        savedCall?.resolve(result)
        savedCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            savedCall?.reject("User cancelled", "CANCELLED")
        } else {
            savedCall?.reject(error.localizedDescription)
        }
        savedCall = nil
    }
}
