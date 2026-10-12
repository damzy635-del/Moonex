import i18n from "i18next";
import {initReactI18next} from "react-i18next";
void i18n.use(initReactI18next).init({resources:{en:{common:{newChat:"New chat",search:"Search chats",recent:"Recent",placeholder:"Ask anything",welcome:"What can I help you with?",welcomeHint:"A clear starting point for whatever you're working on.",disclaimer:"Moonex can make mistakes. Check important information.",send:"Send message"}}},lng:"en",fallbackLng:"en",defaultNS:"common",interpolation:{escapeValue:false}});
export default i18n;