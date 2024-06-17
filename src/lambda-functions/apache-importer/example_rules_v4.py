examples = [
    {
        "input_doc":"RedirectMatch 301 ^/digital-stay/zel-mallorca/ipad-front-desk1$ https://www1.melia.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=0707&idLang=en&origin=HOTEL",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/digital-stay/zel-mallorca/ipad-front-desk1</path>
            <regex/>
            <to>https://www1.melia.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=0707&idLang=en&origin=HOTEL</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 302 ^/(.*)/register-signin$ https://www1.melia.com/$1/user-signup/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/register-signin</regex>
            <to>https://www1.melia.com/$1/user-signup/</to>
            <sc>302</sc>
        """
    },{
        "input_doc":"RedirectMatch 301 ^/pt/hoteis/(.*)?$ https://www.melia.com/pt/hoteis/$1",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/pt/hoteis/(.*)?</regex>
            <to>https://www.melia.com/pt/hoteis/$1</to>
            <sc>301</sc>
        """
    },
     {
        "input_doc":"RedirectMatch 301 ^/en/melia-safe-destination/melia-safe-destination.html$ https://d386qydlir9949.cloudfront.net/es/travel-safe-with-melia.html",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/en/melia-safe-destination/melia-safe-destination.html</path>
            <regex/>
            <to>https://d386qydlir9949.cloudfront.net/es/travel-safe-with-melia.html</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 301 ^/dam/jcr(.*)(jfif|pdf)$ https://d386qydlir9949.cloudfront.net/dam/jcr$1$2",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/dam/jcr(.*)(jfif|pdf)</regex>
            <to>https://d386qydlir9949.cloudfront.net/dam/jcr$1$2</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 302 ^/someplace/universities/(.*)/iid-us(.*)/$ https://www-uat.idp.com/someplace/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/someplace/universities/(.*)/iid-us(.*)/</regex>
            <to>https://www-uat.idp.com/someplace/</to>
            <sc>302</sc>
        """
    }
]