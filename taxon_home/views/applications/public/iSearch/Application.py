'''
    Application for the Search Page of the DOME
    URL: / or /index.html

    Author: Andrew Oberlin
    Date: August 5, 2012

    Modified by Kyoung Tak Cho
    Date: November 1, 2016
'''
from renderEngine.ApplicationBase import ApplicationBase
from taxon_home.views.pagelets.public.ImageSearchPagelet import ImageSearchPagelet
from taxon_home.views.pagelets.public.iSearchPagelet import iSearchPagelet
from taxon_home.views.pagelets.public.GBrowseSearchPagelet import GBrowseSearchPagelet
from taxon_home.views.pagelets.public.NavBarPagelet import NavBarPagelet
from taxon_home.views.pagelets.public.FooterPagelet import FooterPagelet
from taxon_home.models import Picture, GeneLink, Tag, Feature
from taxon_home.models import PictureNotes, PictureMgdb, PictureGeneID
from taxon_home.models import Locus
from taxon_home.models import iSearchHistory
#from taxon_home.models import Organism
#from taxon_home.models import GeneLink
#from taxon_home.models import Feature
#from django.db.models import Q
from taxon_home.views.util import Util

class Application(ApplicationBase):
    def doProcessRender(self, request):
        self.addPageletBinding('navBar', NavBarPagelet())

        numSearch = 0
        searchCats = 0
        searchImageDesc = str(request.GET.get('searchImageDesc', '')).lower() == "true"
        searchImageNotes = str(request.GET.get('searchImageNotes', '')).lower() == "true"
        searchGeneName = str(request.GET.get('searchGeneName', '')).lower() == "true"
        searchGeneSymbol = str(request.GET.get('searchGeneSymbol', '')).lower() == "true"
        searchGeneID = str(request.GET.get('searchGeneID', '')).lower() == "true"
        query = Util.getDelimitedList(request.GET,'query')
        if not query:
            query = ''

        #candidates = [['Image Description'], ['Image Notes'], ['Gene Name'], ['Gene Symbol'], ['Gene ID']]
        candidates = [['0'], ['1'], ['2'], ['3'], ['4']]


        if searchImageDesc:
            candidates[0][0] = 'Image Description'
            pictures = Picture.objects.filter(description__icontains=query[0])
            for picture in pictures:
                candidates[0].append(picture)

        if searchImageNotes:
            candidates[1][0] = 'Image Notes'
            pNotes = PictureNotes.objects.filter(notes__icontains=query[0])
            pictureIDs = []
            for note in pNotes:
                pictureID = note.picture_id
                if not pictureID in pictureIDs:
                    pictureIDs.append(pictureID)
                    candidates[1].append(pictureID)

        if searchGeneName:
            candidates[2][0] = 'Gene Name'
            pictureIDs = []
            pMgdbs = PictureMgdb.objects.filter(locus_full_name__icontains=query[0])
            for pMgdb in pMgdbs:
                pictureID = pMgdb.picture.pk
                if not pictureID in pictureIDs:
                    pictureIDs.append(pictureID)
                    candidates[2].append(pictureID)

        if searchGeneSymbol:
            candidates[3][0] = 'Gene Symbol'
            pictureIDs = []
            pMgdbs = PictureMgdb.objects.filter(locus_name__icontains=query[0])
            for pMgdb in pMgdbs:
                pictureID = pMgdb.picture.pk
                if not pictureID in pictureIDs:
                    pictureIDs.append(pictureID)
                    candidates[3].append(pictureID)

        if searchGeneID:
            candidates[4][0] = 'Gene ID'
            pictureIDs = []
            pIDs = PictureGeneID.objects.filter(gene_id__icontains=query[0])
            for pID in pIDs:
                pictureID = pID.picture.pk
                if pictureID not in pictureIDs:
                    pictureIDs.append(pictureID)
                    candidates[4].append(pictureID)

        # Store searching keyword
        newKeyword, created = iSearchHistory.objects.get_or_create(keyword=query[0], user=request.user)
        if not created:
            newKeyword.save()

        formatQuery = ""
        if query:
            formatQuery += 'General Query: "' + ", ".join(query) + '"'


        search = {
            'candidates' : candidates,
            'query' : query[0]
        }

        numSearch += 1
        self.addPageletBinding('center-' + str(numSearch), iSearchPagelet().setSearchParams(search))

        args = {
            'title' : 'iSearch',
            'numPagelets' : numSearch
        }
        self.setApplicationLayout('public/iSearch.html', args)

        self.addPageletBinding('footer', FooterPagelet())

'''
    Used for mapping to the url in urls.py
'''
def renderAction(request):
    return Application().render(request)

