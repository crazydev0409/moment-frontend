import { Image, View } from "react-native";
import tw from "tailwindcss";
import { Splash } from "~/lib/images";
import LottieView from "lottie-react-native";

const SplashScreen = () => {
    return (
        <View style={tw`flex-1 relative bg-white`}>
            <Image source={Splash} style={tw`absolute w-full h-full`} />
            <View style={tw`absolute bottom-20 w-full flex-row justify-center`}>
                <LottieView
                    source={require('../../assets/animations/splash-loading.json')}
                    autoPlay
                    loop
                    style={tw`w-20 h-20`}
                />
            </View>
        </View>
    );
}

export default SplashScreen;