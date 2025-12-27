import { Image, View } from "react-native";
import tw from '~/tailwindcss';
import { Splash } from "~/lib/images";
import LottieView from "lottie-react-native";
import { horizontalScale, verticalScale } from "~/helpers/responsive";

const SplashScreen = () => {
    return (
        <View style={tw`flex-1 relative bg-white`}>
            <Image source={Splash} style={tw`absolute w-full h-full`} />
            <View style={[tw`absolute w-full flex-row justify-center`, { bottom: verticalScale(75) }]}>
                <LottieView
                    source={require('../../assets/animations/splash-loading.json')}
                    autoPlay
                    loop
                    style={[tw``, { width: horizontalScale(75), height: horizontalScale(75) }]}
                />
            </View>
        </View>
    );
}

export default SplashScreen;