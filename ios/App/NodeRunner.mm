// Brücke zu nodejs-mobile: node_start() erwartet die Argumente in einem zusammenhängenden Speicherblock (libuv).
#import "NodeRunner.h"
#include <NodeMobile/NodeMobile.h>

@implementation NodeRunner

+ (void)startEngineWithArguments:(NSArray<NSString *> *)arguments {
    int argc = (int)arguments.count;
    size_t gesamt = 0;
    for (NSString *arg in arguments) gesamt += strlen([arg UTF8String]) + 1;
    char *puffer = (char *)calloc(gesamt, sizeof(char));
    char **argv = (char **)calloc((size_t)argc + 1, sizeof(char *));
    char *position = puffer;
    for (int i = 0; i < argc; i++) {
        const char *c = [arguments[(NSUInteger)i] UTF8String];
        size_t laenge = strlen(c);
        memcpy(position, c, laenge);
        argv[i] = position;
        position += laenge + 1;
    }
    node_start(argc, argv);
    free(argv);
    free(puffer);
}

@end
