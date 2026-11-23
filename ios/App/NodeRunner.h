// Startet Node.js (nodejs-mobile) in diesem Prozess. Die Funktion kehrt erst zurück, wenn Node beendet wird.
#import <Foundation/Foundation.h>

@interface NodeRunner : NSObject
+ (void)startEngineWithArguments:(NSArray<NSString *> *)arguments;
@end
